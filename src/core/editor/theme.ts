import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import type { ThemeMode } from '../types';

interface Palette {
  bg: string;
  panel: string;
  ink: string;
  muted: string;
  line: string;
  selection: string;
  activeLine: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
  typeName: string;
  atom: string;
  operator: string;
  variable: string;
}

function paletteFor(mode: ThemeMode, accent: string): Palette {
  if (mode === 'light') {
    return {
      bg: '#ffffff',
      panel: '#f6f7f9',
      ink: '#1f2430',
      muted: '#8a93a2',
      line: '#e5e7eb',
      selection: '#d1fae5',
      activeLine: '#f3f4f6',
      keyword: '#7c3aed',
      string: '#15803d',
      number: '#b45309',
      comment: '#9ca3af',
      typeName: '#2563eb',
      atom: '#db2777',
      operator: '#c2410c',
      variable: '#0f172a',
    };
  }
  if (mode === 'cyber') {
    return {
      bg: '#07030f',
      panel: '#0d0620',
      ink: '#e9d5ff',
      muted: '#8b5cf6',
      line: '#2a1050',
      selection: '#4c1d95',
      activeLine: '#150a2e',
      keyword: '#f0abfc',
      string: '#22d3ee',
      number: '#fde047',
      comment: '#7e22ce',
      typeName: '#38bdf8',
      atom: '#f472b6',
      operator: '#fb7185',
      variable: '#e9d5ff',
    };
  }
  return {
    bg: '#0b0d10',
    panel: '#101318',
    ink: '#d7dae0',
    muted: '#6b7484',
    line: '#1e242e',
    selection: '#1f3b32',
    activeLine: '#12161c',
    keyword: '#c084fc',
    string: '#4ade80',
    number: '#fbbf24',
    comment: '#5b6472',
    typeName: '#60a5fa',
    atom: '#f472b6',
    operator: '#fb923c',
    variable: '#e2e8f0',
  };
}

/** 按主题模式生成 CodeMirror 主题与高亮（跟随 accent 强调色） */
export function createEditorTheme(mode: ThemeMode, accent: string): Extension[] {
  const dark = mode !== 'light';
  const c = paletteFor(mode, accent);

  const theme = EditorView.theme(
    {
      '&': {
        backgroundColor: c.bg,
        color: c.ink,
        height: '100%',
        fontSize: '13px',
      },
      '.cm-scroller': {
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
        lineHeight: '1.65',
        overflow: 'auto',
      },
      '.cm-content': {
        padding: '10px 0',
        caretColor: accent,
      },
      '.cm-line': { padding: '0 14px 0 4px' },
      '.cm-gutters': {
        backgroundColor: c.panel,
        color: c.muted,
        borderRight: `1px solid ${c.line}`,
      },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px', minWidth: '34px' },
      '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', color: c.muted },
      '.cm-activeLine': { backgroundColor: c.activeLine },
      '.cm-activeLineGutter': { backgroundColor: c.activeLine, color: accent },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: c.selection,
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: accent, borderLeftWidth: '2px' },
      '&.cm-focused .cm-matchingBracket': {
        backgroundColor: 'transparent',
        outline: `1px solid ${accent}66`,
      },
      '.cm-tooltip': {
        backgroundColor: c.panel,
        border: `1px solid ${c.line}`,
        color: c.ink,
        borderRadius: '8px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: `${accent}33`,
        color: c.ink,
      },
      '.cm-diagnostic': { padding: '4px 6px' },
      '.cm-panels': { backgroundColor: c.panel, color: c.ink },
      '.cm-searchMatch': { backgroundColor: `${accent}33`, outline: `1px solid ${accent}88` },
      '.cm-foldPlaceholder': {
        backgroundColor: `${accent}22`,
        border: `1px solid ${accent}55`,
        color: accent,
        padding: '0 6px',
        borderRadius: '4px',
      },
    },
    { dark },
  );

  const highlight = HighlightStyle.define([
    { tag: t.keyword, color: c.keyword, fontWeight: '600' },
    { tag: t.string, color: c.string },
    { tag: t.number, color: c.number },
    { tag: t.comment, color: c.comment, fontStyle: 'italic' },
    { tag: t.typeName, color: c.typeName, fontWeight: '600' },
    { tag: t.className, color: c.atom },
    { tag: t.atom, color: c.atom },
    { tag: t.operator, color: c.operator },
    { tag: t.variableName, color: c.variable },
    { tag: t.special(t.variableName), color: c.string },
    { tag: t.invalid, color: '#f87171' },
  ]);

  return [theme, syntaxHighlighting(highlight)];
}
