const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSystemPrompt, truncateTranscript } = require('../src/main/prompt.js');

test('always states the assistant role and first-person instruction', () => {
  const p = buildSystemPrompt('', '');
  assert.match(p, /real-time call assistant/i);
  assert.match(p, /first person/i);
});

test('omits resume/JD sections and grounding clause when profile is empty', () => {
  const p = buildSystemPrompt('', '');
  assert.ok(!p.includes('RESUME'));
  assert.ok(!p.includes('JOB THEY ARE INTERVIEWING FOR'));
  assert.ok(!/Ground every answer/.test(p));
});

test('embeds the resume when provided', () => {
  const p = buildSystemPrompt('10 years building payments systems', '');
  assert.match(p, /--- THE USER'S RESUME ---/);
  assert.match(p, /payments systems/);
  assert.match(p, /Ground every answer/);
});

test('embeds the job description when provided', () => {
  const p = buildSystemPrompt('', 'Senior Backend Engineer, Go and Postgres');
  assert.match(p, /--- THE JOB THEY ARE INTERVIEWING FOR ---/);
  assert.match(p, /Senior Backend Engineer/);
});

test('includes both sections and the grounding clause when both are set', () => {
  const p = buildSystemPrompt('resume text', 'job text');
  assert.match(p, /resume text/);
  assert.match(p, /job text/);
  assert.match(p, /Never invent experience/);
});

test('trims whitespace-only input so it counts as empty', () => {
  const p = buildSystemPrompt('   \n  ', '\t');
  assert.ok(!p.includes('RESUME'));
  assert.ok(!/Ground every answer/.test(p));
});

// ---------- robustness / property-style checks ----------

test('tolerates null and undefined inputs without throwing', () => {
  for (const args of [[null, null], [undefined, undefined], [null, undefined], [], [undefined, 'jd']]) {
    const p = buildSystemPrompt(...args);
    assert.equal(typeof p, 'string');
    assert.ok(p.length > 50, 'base instructions always present');
  }
});

test('preserves every line of a multi-line resume verbatim', () => {
  const resume = 'Jane Doe\nStaff Engineer @ Acme (2019-2024)\n- Led payments team of 8\n- C++ / (regex) special *chars* [ok]?';
  const p = buildSystemPrompt(resume, '');
  for (const line of resume.split('\n')) {
    assert.ok(p.includes(line), `prompt should contain resume line: ${line}`);
  }
});

test('handles a very large resume without truncating it', () => {
  const resume = ('experience line with unique marker XYZZY\n').repeat(2000); // ~80KB
  const p = buildSystemPrompt(resume, 'short jd');
  assert.ok(p.includes(resume.trim()), 'full resume text embedded');
  assert.ok(p.length >= resume.trim().length);
  assert.ok(p.includes('short jd'));
});

test('base instructions come before the resume and JD sections', () => {
  const p = buildSystemPrompt('MY_RESUME_MARK', 'MY_JD_MARK');
  const base = p.indexOf('call assistant');
  assert.ok(base !== -1);
  assert.ok(base < p.indexOf('MY_RESUME_MARK'));
  assert.ok(p.indexOf('MY_RESUME_MARK') < p.indexOf('MY_JD_MARK'), 'resume section precedes JD section');
});

test('output is deterministic for the same inputs', () => {
  assert.equal(buildSystemPrompt('r', 'j'), buildSystemPrompt('r', 'j'));
});

// ---------- truncateTranscript ----------

test('truncateTranscript leaves short transcripts unchanged', () => {
  assert.equal(truncateTranscript('what is your greatest weakness?'), 'what is your greatest weakness?');
});

test('truncateTranscript tolerates empty/null input', () => {
  assert.equal(truncateTranscript(''), '');
  assert.equal(truncateTranscript(null), '');
  assert.equal(truncateTranscript(undefined), '');
});

test('truncateTranscript keeps the newest speech (the end) when over budget', () => {
  const long = 'OLD_SPEECH '.repeat(500) + 'FINAL QUESTION HERE';
  const out = truncateTranscript(long, 100);
  assert.ok(out.includes('FINAL QUESTION HERE'), 'the end of the transcript survives');
  assert.ok(out.length <= 100 + 60, 'result stays near the budget (allowing a small truncation marker)');
});

test('truncateTranscript bounds arbitrarily huge input', () => {
  const huge = 'x'.repeat(1_000_000) + ' THE QUESTION';
  const out = truncateTranscript(huge);
  assert.ok(out.length < 20_000, `bounded output, got ${out.length} chars`);
  assert.ok(out.endsWith('THE QUESTION'));
});
