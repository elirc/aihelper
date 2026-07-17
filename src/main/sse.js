// Parser for OpenAI-style Server-Sent Events (the shape DeepSeek streams).
//
// Network chunks do not align to line or event boundaries: a single `data:` line
// can be split across two reads, and one read can contain several lines. Feed each
// decoded chunk to parseSSEChunk together with whatever was left over from the last
// call; it returns the content deltas found in the *complete* lines, the trailing
// partial line to carry forward as `rest`, and a `done` flag that turns true once
// the `[DONE]` sentinel has been seen so callers can stop reading the socket early.
//
// Dialect notes:
// - Lines may end in LF or CRLF; a trailing \r is stripped before parsing.
// - `data:` with or without the space after the colon is accepted.
// - Comment/keep-alive lines (`: ...`), blank lines, and other SSE fields
//   (event:, id:, retry:) are ignored.
// - Each complete `data:` line is treated as one self-contained JSON payload,
//   which is what OpenAI-compatible streams emit. Spec-style joining of
//   consecutive `data:` lines into one event would corrupt these per-line JSON
//   payloads, so it is deliberately not done here.
// - Malformed JSON payloads and deltas without string content (e.g. the
//   role-only opener or a usage-only final chunk) are skipped, never thrown.
function parseSSEChunk(buffer) {
  const deltas = [];
  let done = false;
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    let line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (line.endsWith('\r')) line = line.slice(0, -1); // tolerate CRLF endings
    line = line.trim();
    if (!line.startsWith('data:')) continue;           // comments/keep-alives/blank lines/other fields
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') { done = true; continue; }
    if (!payload) continue;                            // empty data line
    try {
      const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) deltas.push(delta);
    } catch {
      // malformed/partial JSON — ignore this line rather than crash the stream
    }
  }
  return { deltas, rest: buffer, done };
}

module.exports = { parseSSEChunk };
