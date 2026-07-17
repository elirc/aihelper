const { app, BrowserWindow, session, desktopCapturer, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { registerIpc } = require('./ipc');

// Last-resort logging so a stray error can't silently kill the main process.
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason);
});

// Only the documented "get an API key" pages may be handed to the OS browser.
const EXTERNAL_LINK_HOSTS = new Set([
  'cloud.siliconflow.com',
  'platform.deepseek.com'
]);

function isAllowedExternalUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && EXTERNAL_LINK_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 460,
    height: 700,
    minWidth: 380,
    minHeight: 520,
    title: 'AI Call Assistant',
    autoHideMenuBar: true,
    alwaysOnTop: store.get('alwaysOnTop', true),
    backgroundColor: '#16181d',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });

  // Hide the window from screen sharing / screen recording (WDA_EXCLUDEFROMCAPTURE).
  win.setContentProtection(true);

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
    .catch((err) => console.error('[main] Failed to load renderer:', err));

  // The app is a single local page: block all page-initiated navigation.
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Never open child windows. Allowlisted external links (e.g. "get API key")
  // open in the default browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url).catch((err) => {
        console.error('[main] Failed to open external URL:', err);
      });
    }
    return { action: 'deny' };
  });

  // No <webview> tags, ever (belt and braces alongside webviewTag: false).
  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  win.on('closed', () => { win = null; });
}

// Single-instance guard: a second launch focuses the existing window instead
// of racing the first instance for the settings file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    // Deny every Chromium permission except the audio capture the app needs.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'media' || permission === 'display-capture');
    });

    // Route getDisplayMedia to Windows system-audio loopback so the app can hear
    // whatever the call application is playing, without any screen picker UI.
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] })
        .then((sources) => {
          if (sources.length > 0) callback({ video: sources[0], audio: 'loopback' });
          else callback(null);
        })
        .catch(() => callback(null));
    });

    registerIpc(() => win);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch((err) => {
    console.error('[main] Startup failed:', err);
    app.quit();
  });
}

app.on('window-all-closed', () => {
  app.quit();
});
