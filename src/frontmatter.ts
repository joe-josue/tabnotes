/**
 * Minimal YAML-like frontmatter parser for Obsidian-compatible notes.
 *
 * Supports:
 *   - string values
 *   - inline arrays:  tags: [a, b, c]
 *   - block arrays:   tags:\n  - a\n  - b
 *   - booleans, numbers
 *   - quoted strings
 *
 * Preserves all unknown keys — never does a destructive rewrite.
 * Notes without a --- fence are left completely untouched.
 */

export type FrontmatterMeta = {
  title?: string;
  tags?: string[];
  created?: string;
  updated?: string;
  [key: string]: unknown;
};

// Must start at position 0 — Obsidian/Jekyll spec
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseValue(raw: string): unknown {
  const s = raw.trim();
  // Inline array: [a, b, c]
  if (s.startsWith('[') && s.endsWith(']')) {
    return s
      .slice(1, -1)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  // Boolean
  if (s === 'true') return true;
  if (s === 'false') return false;
  // Number
  if (s !== '' && !Number.isNaN(Number(s))) return Number(s);
  // Quoted string
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function parseBlock(block: string): FrontmatterMeta {
  const result: FrontmatterMeta = {};
  const lines = block.split(/\r?\n/);
  let currentKey: string | null = null;

  for (const line of lines) {
    if (line.trim() === '') continue;

    // Block list item (indented dash)
    const listMatch = /^[ \t]+-\s+(.+)$/.exec(line);
    if (listMatch && currentKey !== null) {
      const existing = result[currentKey];
      result[currentKey] = Array.isArray(existing)
        ? [...existing, listMatch[1].trim()]
        : [listMatch[1].trim()];
      continue;
    }

    // key: value  (key must start with letter or underscore)
    const kvMatch = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const raw = kvMatch[2].trim();
      // empty value → will be filled by block list items, or stays undefined
      result[currentKey] = raw === '' ? undefined : parseValue(raw);
    }
  }

  return result;
}

// ── Serialising ───────────────────────────────────────────────────────────────

function serializeValue(v: unknown): string {
  if (Array.isArray(v)) {
    return v.length === 0 ? '[]' : '[' + v.map(String).join(', ') + ']';
  }
  if (typeof v === 'string') {
    // Quote if the value looks like a YAML special token or contains colons
    if (/^[:{[\]|>&*!,]/.test(v) || /^(true|false|null|~|\d)/.test(v) || v.includes('\n')) {
      return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return v;
  }
  return String(v);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a note body. Returns null if no frontmatter is present.
 * `content` is everything after the closing `---`.
 */
export function parseFrontmatter(
  body: string
): { meta: FrontmatterMeta; content: string } | null {
  const match = FM_RE.exec(body);
  if (!match) return null;
  const meta = parseBlock(match[1]);
  // Normalise tags to always be an array when present
  if (typeof meta.tags === 'string') meta.tags = [meta.tags as string];
  const content = body.slice(match[0].length);
  return { meta, content };
}

/**
 * Rebuild a full document string from metadata + content.
 * Undefined/null values and empty arrays are omitted.
 * Key order is preserved (insertion order of the meta object).
 */
export function buildFrontmatter(meta: FrontmatterMeta, content: string): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    lines.push(`${k}: ${serializeValue(v)}`);
  }
  lines.push('---');
  const fence = lines.join('\n') + '\n';
  // Ensure exactly one blank line between fence and content
  const trimmed = content.replace(/^\n+/, '');
  return fence + '\n' + trimmed;
}

/** Strip frontmatter and return content only. If no FM, returns body as-is. */
export function stripFrontmatter(body: string): string {
  const match = FM_RE.exec(body);
  return match ? body.slice(match[0].length).replace(/^\n+/, '') : body;
}

/** ISO date string for today (YYYY-MM-DD, local timezone). */
export function isoToday(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

/**
 * If the body has frontmatter, return a copy with `updated` set to today
 * and `created` filled in if missing. If no frontmatter, returns body unchanged.
 *
 * Call this at export/download time — never on autosave — to avoid
 * triggering a change event that would loop back through the editor.
 */
export function touchTimestamps(body: string): string {
  const fm = parseFrontmatter(body);
  if (!fm) return body;
  const now = isoToday();
  const meta = { ...fm.meta };
  if (!meta.created) meta.created = now;
  meta.updated = now;
  return buildFrontmatter(meta, fm.content);
}
