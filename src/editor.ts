import { Compartment, EditorState, RangeSetBuilder, Transaction } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  keymap
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle, syntaxTree } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { tags as t } from '@lezer/highlight';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import type { RenderMode } from './storage';

export type EditorHandle = {
  view: EditorView;
  setContent: (body: string) => void;
  focus: () => void;
  setMode: (mode: RenderMode) => void;
};

type Options = {
  parent: HTMLElement;
  initial: string;
  initialMode: RenderMode;
  onChange: (body: string) => void;
  onSave: () => void;
};

function wrapSelection(view: EditorView, marker: string): boolean {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to);
    const replacement = marker + selected + marker;
    return {
      changes: { from: range.from, to: range.to, insert: replacement },
      range: range.empty
        ? { anchor: range.from + marker.length }
        : { anchor: range.from, head: range.to + marker.length * 2 }
    };
  });
  view.dispatch(
    state.update(changes, {
      scrollIntoView: true,
      annotations: Transaction.userEvent.of('input')
    })
  );
  return true;
}

const headingLine = [
  Decoration.line({ attributes: { class: 'tn-h1' } }),
  Decoration.line({ attributes: { class: 'tn-h2' } }),
  Decoration.line({ attributes: { class: 'tn-h3' } }),
  Decoration.line({ attributes: { class: 'tn-h4' } }),
  Decoration.line({ attributes: { class: 'tn-h5' } }),
  Decoration.line({ attributes: { class: 'tn-h6' } })
];

const HIDEABLE_MARKS = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'StrikethroughMark'
]);

const hideMark = Decoration.replace({});

function activeLineNumbers(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const r of state.selection.ranges) {
    let line = state.doc.lineAt(r.from);
    lines.add(line.number);
    while (line.to < r.to) {
      line = state.doc.lineAt(line.to + 1);
      lines.add(line.number);
    }
  }
  return lines;
}

// ── Heading line decorations ─────────────────────────────────────────────────
// Separate from mark-hiding so Decoration.line and Decoration.replace are
// never mixed in the same RangeSet (mixed sorts are undefined behaviour).
function buildHeadingDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const match = /^(#{1,6})\s+\S/.exec(line.text);
      if (match) {
        builder.add(line.from, line.from, headingLine[match[1].length - 1]);
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

// ── Mark hiding (replace decorations) ────────────────────────────────────────
// Hides syntax marks (**, *, `, ~~) on any line the cursor is NOT on.
function buildMarkHideDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const state = view.state;
  const active = activeLineNumbers(state);

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (!HIDEABLE_MARKS.has(node.name)) return;
        const lineNo = state.doc.lineAt(node.from).number;
        if (active.has(lineNo)) return;
        let end = node.to;
        // Extend over trailing whitespace so headings drop their leading space.
        if (node.name === 'HeaderMark') {
          const docLen = state.doc.length;
          while (end < docLen && state.sliceDoc(end, end + 1) === ' ') end++;
        }
        if (end > node.from) {
          builder.add(node.from, end, hideMark);
        }
      }
    });
  }
  return builder.finish();
}

const markdownHighlight = HighlightStyle.define([
  // ── Markdown ────────────────────────────────────────────────────────────────
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', color: 'var(--accent)' },
  { tag: t.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--muted)' },
  { tag: t.meta, color: 'var(--muted)' },
  { tag: t.processingInstruction, color: 'var(--muted)' },
  { tag: t.quote, color: 'var(--muted)', fontStyle: 'italic' },
  // ── Code block tokens ───────────────────────────────────────────────────────
  { tag: [t.keyword, t.bool, t.null], color: 'var(--hl-kw)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--hl-str)' },
  { tag: t.comment, color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: [t.number, t.integer, t.float], color: 'var(--hl-num)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--hl-type)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--hl-fn)' },
  { tag: [t.definition(t.variableName), t.variableName], color: 'var(--hl-var)' },
  { tag: t.propertyName, color: 'var(--hl-prop)' },
  { tag: [t.tagName, t.angleBracket], color: 'var(--hl-tag)' },
  { tag: t.attributeName, color: 'var(--hl-attr)' },
  { tag: t.operator, color: 'var(--hl-op)' },
  { tag: t.punctuation, color: 'var(--muted)' },
]);

// ── Hanging-indent for list lines ────────────────────────────────────────────
// When a bullet / numbered-list line wraps, the continuation should align with
// the first character of the text (after the marker), not with column 0.
// We achieve this via:  padding-left: Nch  +  text-indent: -Nch
// where N is the position of the text start (leading spaces + marker + space).
const LIST_MARKER_RE = /^(\s*)([-*+]|\d+\.)\s/;

function buildListDecorations(view: EditorView): DecorationSet {
  const decos: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const m = LIST_MARKER_RE.exec(line.text);
      if (m) {
        // offset = leading spaces + marker length + 1 (the space after the marker)
        const offset = m[1].length + m[2].length + 1;
        decos.push(
          Decoration.line({
            attributes: {
              style: `padding-left:${offset}ch;text-indent:-${offset}ch`
            }
          }).range(line.from)
        );
      }
      pos = line.to + 1;
    }
  }
  return Decoration.set(decos, true);
}

const listWrapPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = buildListDecorations(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) {
        this.decorations = buildListDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

const headingPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = buildHeadingDecorations(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) {
        this.decorations = buildHeadingDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

const markHidePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = buildMarkHideDecorations(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet) {
        this.decorations = buildMarkHideDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--editor-font-size, 16px)',
    backgroundColor: 'transparent',
    color: 'var(--fg)'
  },
  '.cm-scroller': {
    fontFamily:
      'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
    lineHeight: '1.7',
    padding: '4rem clamp(1.5rem, 10vw, 8rem) 6rem'
  },
  '.cm-content': {
    maxWidth: '720px',
    margin: '0 auto',
    caretColor: 'var(--accent)'
  },
  '.cm-line': { padding: '0' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--selection)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--selection)' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-line.tn-h1': {
    fontSize: '1.9em',
    fontWeight: '700',
    lineHeight: '1.25',
    padding: '0.6em 0 0.1em',
    color: 'var(--hl-h1)'
  },
  '.cm-line.tn-h2': {
    fontSize: '1.5em',
    fontWeight: '700',
    lineHeight: '1.3',
    padding: '0.5em 0 0.1em',
    color: 'var(--hl-h2)'
  },
  '.cm-line.tn-h3': {
    fontSize: '1.25em',
    fontWeight: '600',
    lineHeight: '1.35',
    padding: '0.4em 0 0.1em',
    color: 'var(--hl-h3)'
  },
  '.cm-line.tn-h4': { fontSize: '1.1em', fontWeight: '600', color: 'var(--hl-h4)' },
  '.cm-line.tn-h5': { fontSize: '1.05em', fontWeight: '600', color: 'var(--hl-h5)' },
  '.cm-line.tn-h6': { fontSize: '1em', fontWeight: '600', color: 'var(--hl-h6)' }
});

const mode = new Compartment();

function modeExtension(m: RenderMode) {
  return m === 'markdown'
    ? [markdown({ codeLanguages: languages }), syntaxHighlighting(markdownHighlight, { fallback: true }), headingPlugin, markHidePlugin, closeBrackets()]
    : [];
}

export function createEditor(opts: Options): EditorHandle {
  let last = opts.initial;

  const state = EditorState.create({
    doc: opts.initial,
    extensions: [
      history(),
      mode.of(modeExtension(opts.initialMode)),
      EditorView.lineWrapping,
      listWrapPlugin,
      editorTheme,
      keymap.of([
        // Tab / Shift-Tab → indent / unindent current line(s).
        // Must come before defaultKeymap so our bindings win over insertTab.
        { key: 'Tab', run: indentMore },
        { key: 'Shift-Tab', run: indentLess },
        ...closeBracketsKeymap,
        { key: 'Mod-b', run: (v) => wrapSelection(v, '**') },
        { key: 'Mod-i', run: (v) => wrapSelection(v, '*') },
        { key: 'Mod-`', run: (v) => wrapSelection(v, '`') },
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            opts.onSave();
            return true;
          }
        },
        ...historyKeymap,
        ...defaultKeymap
      ]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          const body = u.state.doc.toString();
          if (body !== last) {
            last = body;
            opts.onChange(body);
          }
        }
      })
    ]
  });

  const view = new EditorView({ state, parent: opts.parent });

  return {
    view,
    setContent(body: string) {
      if (body === view.state.doc.toString()) return;
      last = body;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: body }
      });
    },
    focus() {
      view.focus();
    },
    setMode(m: RenderMode) {
      view.dispatch({ effects: mode.reconfigure(modeExtension(m)) });
    }
  };
}
