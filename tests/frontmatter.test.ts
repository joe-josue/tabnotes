/**
 * Frontmatter round-trip verification.
 *
 * Run with:  npx tsx tests/frontmatter.test.ts
 *
 * Uses only Node built-ins (assert) — no test framework needed.
 */

import assert from 'node:assert/strict';
import {
  parseFrontmatter,
  buildFrontmatter,
  stripFrontmatter,
  touchTimestamps,
  isoToday,
  type FrontmatterMeta
} from '../src/frontmatter';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${(err as Error).message}`);
    failed++;
  }
}

// ── 1. No frontmatter — untouched ────────────────────────────────────────────
test('returns null for plain body', () => {
  assert.equal(parseFrontmatter('Hello world'), null);
});

test('stripFrontmatter returns body unchanged when no FM', () => {
  const body = '# Title\n\nContent.';
  assert.equal(stripFrontmatter(body), body);
});

// ── 2. Basic parse ────────────────────────────────────────────────────────────
test('parses title and content', () => {
  const body = '---\ntitle: My Note\n---\n\nContent here.';
  const result = parseFrontmatter(body);
  assert.ok(result);
  assert.equal(result.meta.title, 'My Note');
  assert.equal(result.content.trim(), 'Content here.');
});

test('parses inline array tags', () => {
  const body = '---\ntags: [a, b, c]\n---\n\nHi.';
  const result = parseFrontmatter(body);
  assert.deepEqual(result?.meta.tags, ['a', 'b', 'c']);
});

test('parses block array tags', () => {
  const body = '---\ntags:\n  - alpha\n  - beta\n---\n\nBody.';
  const result = parseFrontmatter(body);
  assert.deepEqual(result?.meta.tags, ['alpha', 'beta']);
});

test('parses numbers', () => {
  const body = '---\ncount: 42\n---\n\n.';
  const result = parseFrontmatter(body);
  assert.equal(result?.meta.count, 42);
});

test('parses booleans', () => {
  const body = '---\ndraft: true\n---\n\n.';
  const result = parseFrontmatter(body);
  assert.equal(result?.meta.draft, true);
});

test('preserves unknown keys', () => {
  const body = '---\nmy_custom_key: hello\ntitle: Test\n---\n\n.';
  const result = parseFrontmatter(body);
  assert.equal(result?.meta.my_custom_key, 'hello');
  assert.equal(result?.meta.title, 'Test');
});

// ── 3. Round-trip — parse → build → parse equals original ────────────────────
test('round-trip string value', () => {
  const meta: FrontmatterMeta = { title: 'Round Trip Test', created: '2024-01-01' };
  const content = '\nSome content here.';
  const built = buildFrontmatter(meta, content);
  const parsed = parseFrontmatter(built);
  assert.ok(parsed);
  assert.equal(parsed.meta.title, 'Round Trip Test');
  assert.equal(parsed.meta.created, '2024-01-01');
  assert.ok(parsed.content.includes('Some content here.'));
});

test('round-trip array tags', () => {
  const meta: FrontmatterMeta = { tags: ['coding', 'ideas'] };
  const content = '\nBody.';
  const built = buildFrontmatter(meta, content);
  const parsed = parseFrontmatter(built);
  assert.deepEqual(parsed?.meta.tags, ['coding', 'ideas']);
});

test('round-trip preserves unknown keys', () => {
  const meta: FrontmatterMeta = { title: 'Test', custom: 'preserved', tags: ['x'] };
  const built = buildFrontmatter(meta, '\nContent.');
  const parsed = parseFrontmatter(built);
  assert.equal(parsed?.meta.custom, 'preserved');
});

test('round-trip full note cycle', () => {
  const original = '---\ntitle: Full Test\ntags: [a, b]\ncreated: 2024-01-01\n---\n\nHello world.';
  const parsed = parseFrontmatter(original)!;
  const rebuilt = buildFrontmatter(parsed.meta, parsed.content);
  const reparsed = parseFrontmatter(rebuilt)!;
  assert.equal(reparsed.meta.title, 'Full Test');
  assert.deepEqual(reparsed.meta.tags, ['a', 'b']);
  assert.equal(reparsed.meta.created, '2024-01-01');
  assert.ok(reparsed.content.includes('Hello world.'));
});

// ── 4. stripFrontmatter ───────────────────────────────────────────────────────
test('stripFrontmatter removes fence and returns content only', () => {
  const body = '---\ntitle: Test\n---\n\nContent only.';
  assert.equal(stripFrontmatter(body).trim(), 'Content only.');
});

// ── 5. touchTimestamps ────────────────────────────────────────────────────────
test('touchTimestamps sets updated to today', () => {
  const body = '---\ntitle: Test\n---\n\nContent.';
  const touched = touchTimestamps(body);
  const parsed = parseFrontmatter(touched);
  assert.equal(parsed?.meta.updated, isoToday());
});

test('touchTimestamps sets created if missing', () => {
  const body = '---\ntitle: Test\n---\n\nContent.';
  const touched = touchTimestamps(body);
  const parsed = parseFrontmatter(touched);
  assert.equal(parsed?.meta.created, isoToday());
});

test('touchTimestamps preserves existing created date', () => {
  const body = '---\ntitle: Test\ncreated: 2020-01-01\n---\n\nContent.';
  const touched = touchTimestamps(body);
  const parsed = parseFrontmatter(touched);
  assert.equal(parsed?.meta.created, '2020-01-01');
});

test('touchTimestamps does not modify body without frontmatter', () => {
  const body = '# No frontmatter\n\nJust content.';
  assert.equal(touchTimestamps(body), body);
});

test('touchTimestamps preserves all unknown keys', () => {
  const body = '---\ntitle: T\ncustom_field: preserved\n---\n\nContent.';
  const touched = touchTimestamps(body);
  const parsed = parseFrontmatter(touched);
  assert.equal(parsed?.meta.custom_field, 'preserved');
});

// ── 6. Edge cases ─────────────────────────────────────────────────────────────
test('does not treat --- mid-document as frontmatter', () => {
  const body = '# Title\n\n---\n\nHorizontal rule.';
  assert.equal(parseFrontmatter(body), null);
});

test('handles CRLF line endings', () => {
  const body = '---\r\ntitle: CRLF Test\r\n---\r\n\r\nContent.';
  const result = parseFrontmatter(body);
  assert.equal(result?.meta.title, 'CRLF Test');
});

test('empty tags array round-trips cleanly', () => {
  const meta: FrontmatterMeta = { title: 'T', tags: [] };
  const built = buildFrontmatter(meta, '\nContent.');
  // Empty arrays should be omitted from serialisation
  assert.ok(!built.includes('tags:'));
});

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
