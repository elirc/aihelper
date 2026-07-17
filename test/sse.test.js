const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSSEChunk } = require('../src/main/sse.js');

function dataLine(content) {
  return 'data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n';
}

test('extracts content deltas from complete lines', () => {
  const { deltas, rest } = parseSSEChunk(dataLine('Hello') + dataLine(' world'));
  assert.deepEqual(deltas, ['Hello', ' world']);
  assert.equal(rest, '');
});

test('carries a partial trailing line forward via rest', () => {
  const full = dataLine('one') + dataLine('two');
  const split = Math.floor(full.length * 0.6);
  const first = parseSSEChunk(full.slice(0, split));
  const second = parseSSEChunk(first.rest + full.slice(split));
  assert.deepEqual([...first.deltas, ...second.deltas], ['one', 'two']);
});

test('ignores the [DONE] sentinel', () => {
  const { deltas } = parseSSEChunk(dataLine('hi') + 'data: [DONE]\n');
  assert.deepEqual(deltas, ['hi']);
});

test('skips keep-alive comments and blank lines', () => {
  const { deltas } = parseSSEChunk(': keep-alive\n\n' + dataLine('x'));
  assert.deepEqual(deltas, ['x']);
});

test('tolerates malformed JSON without throwing', () => {
  const { deltas } = parseSSEChunk('data: {not json}\n' + dataLine('ok'));
  assert.deepEqual(deltas, ['ok']);
});

test('drops deltas that have no content field (e.g. role-only opener)', () => {
  const roleOnly = 'data: ' + JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] }) + '\n';
  const { deltas } = parseSSEChunk(roleOnly + dataLine('body'));
  assert.deepEqual(deltas, ['body']);
});

// ---------- edge cases ----------

test('handles CRLF line endings', () => {
  const crlf = dataLine('a').replace(/\n$/, '\r\n') + dataLine('b').replace(/\n$/, '\r\n');
  const { deltas, rest } = parseSSEChunk(crlf);
  assert.deepEqual(deltas, ['a', 'b']);
  assert.equal(rest, '');
});

test('handles [DONE] with CRLF and surrounding whitespace', () => {
  const { deltas, rest } = parseSSEChunk(dataLine('x') + 'data: [DONE]  \r\n');
  assert.deepEqual(deltas, ['x']);
  assert.equal(rest, '');
});

test('accepts data lines with no space after the colon', () => {
  const line = 'data:' + JSON.stringify({ choices: [{ delta: { content: 'tight' } }] }) + '\n';
  const { deltas } = parseSSEChunk(line);
  assert.deepEqual(deltas, ['tight']);
});

test('a chunk with no newline produces no deltas and is returned whole as rest', () => {
  const partial = 'data: {"choices":[{"delta":{"con';
  const { deltas, rest } = parseSSEChunk(partial);
  assert.deepEqual(deltas, []);
  assert.equal(rest, partial);
});

test('feeding the stream one byte at a time yields the same deltas', () => {
  const full =
    ': keep-alive\r\n' +
    dataLine('Hel') +
    '\n' +
    dataLine('lo, ') +
    dataLine('world') +
    'data: [DONE]\n';
  const collected = [];
  let carry = '';
  for (const ch of full) {
    const { deltas, rest } = parseSSEChunk(carry + ch);
    carry = rest;
    collected.push(...deltas);
  }
  assert.equal(collected.join(''), 'Hello, world');
  assert.equal(carry, '');
});

test('a line split across two reads is parsed once completed, never twice', () => {
  const line = dataLine('once');
  const first = parseSSEChunk(line.slice(0, 10));
  assert.deepEqual(first.deltas, []);
  const second = parseSSEChunk(first.rest + line.slice(10));
  assert.deepEqual(second.deltas, ['once']);
  assert.equal(second.rest, '');
});

test('multiple events separated by blank lines all parse in one call', () => {
  const chunk = dataLine('a') + '\n' + dataLine('b') + '\r\n\r\n' + dataLine('c');
  const { deltas } = parseSSEChunk(chunk);
  assert.deepEqual(deltas, ['a', 'b', 'c']);
});

test('valid JSON without the expected shape is skipped without throwing', () => {
  const chunk =
    'data: {"choices":[]}\n' +
    'data: {"choices":[{}]}\n' +
    'data: null\n' +
    'data: 42\n' +
    'data: "string"\n' +
    dataLine('survivor');
  const { deltas } = parseSSEChunk(chunk);
  assert.deepEqual(deltas, ['survivor']);
});

test('preserves whitespace and escaped newlines inside delta content', () => {
  const { deltas } = parseSSEChunk(dataLine('line1\nline2') + dataLine('  spaced  '));
  assert.deepEqual(deltas, ['line1\nline2', '  spaced  ']);
});

test('handles a large burst of many lines in a single chunk', () => {
  let chunk = '';
  for (let i = 0; i < 500; i++) chunk += dataLine('t' + i);
  const { deltas, rest } = parseSSEChunk(chunk);
  assert.equal(deltas.length, 500);
  assert.equal(deltas[0], 't0');
  assert.equal(deltas[499], 't499');
  assert.equal(rest, '');
});

test('non-data fields (event:, id:, retry:) are ignored', () => {
  const chunk = 'event: message\nid: 7\nretry: 100\n' + dataLine('payload');
  const { deltas } = parseSSEChunk(chunk);
  assert.deepEqual(deltas, ['payload']);
});

test('done flag is false while the stream is still open', () => {
  const { done } = parseSSEChunk(dataLine('still going'));
  assert.equal(done, false);
});

test('done flag turns true once the [DONE] sentinel is seen', () => {
  const { deltas, done } = parseSSEChunk(dataLine('last') + 'data: [DONE]\n');
  assert.equal(done, true);
  assert.deepEqual(deltas, ['last'], 'deltas before [DONE] are still returned');
});
