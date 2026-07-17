// Builds the system prompt for the answer model from the user's saved profile.
// Pure functions (no store/electron dependency) so they can be unit-tested directly.

// Character budget that keeps the live-transcript part of the request inside a
// sane share of the model context window (rough rule of thumb: ~4 chars/token).
// Note: the resume and JD are deliberately NOT truncated here — the test suite
// pins full verbatim embedding of the saved profile.
const MAX_TRANSCRIPT_CHARS = 8000;

// Guard against an oversized transcript: keep the newest speech (the end),
// drop the oldest, since the question being answered is always the most recent part.
function truncateTranscript(text, maxChars = MAX_TRANSCRIPT_CHARS) {
  text = (text || '').trim();
  if (text.length <= maxChars) return text;
  return '[...older speech truncated]\n' + text.slice(text.length - maxChars).trimStart();
}

function buildSystemPrompt(resume, jd) {
  resume = (resume || '').trim();
  jd = (jd || '').trim();

  let prompt =
    'You are a real-time call assistant helping the user answer questions asked of them ' +
    'during a live interview or call. You receive a transcript of what the other person just said. ' +
    'Reply with exactly what the user should say, written in first person, in natural spoken English.\n' +
    '\n' +
    'Rules:\n' +
    '- Lead with the direct answer in your first sentence; add supporting detail after it.\n' +
    '- Be concise and confident: 2-4 sentences for simple questions, short structured points for multi-part or technical ones.\n' +
    '- For behavioral questions ("tell me about a time..."), give a compact story: the situation in one line, what the user did, and the concrete result.\n' +
    '- Sound like a person speaking, not an essay: plain words, no filler, no hedging, no buzzword dumps.\n' +
    '- Output only the words to say. No meta commentary, greetings, labels, markdown headings, or quotation marks.\n' +
    '- If the transcript is small talk or contains no real question, briefly suggest the most useful thing the user could say next.\n' +
    '- If the question is about something the user plausibly has not done, answer honestly with the closest relevant experience instead of fabricating.';

  if (resume) prompt += '\n\n--- THE USER\'S RESUME ---\n' + resume;
  if (jd) prompt += '\n\n--- THE JOB THEY ARE INTERVIEWING FOR ---\n' + jd;
  if (resume || jd) {
    prompt += '\n\nGround every answer in the resume and target role above: prefer their real projects, ' +
      'numbers, and technologies. Never invent experience the resume does not support.';
  }
  return prompt;
}

module.exports = { buildSystemPrompt, truncateTranscript };
