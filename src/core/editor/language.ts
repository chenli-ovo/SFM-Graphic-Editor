import { StreamLanguage, type StringStream } from '@codemirror/language';

const KEYWORDS = new Set([
  'name', 'every', 'on', 'pulse', 'redstone', 'input', 'output', 'if', 'else', 'end', 'do', 'then',
  'from', 'to', 'slots', 'slot', 'forget', 'each', 'retain', 'except', 'with', 'without', 'round',
  'robin', 'by', 'global', 'g', 'empty', 'in', 'and', 'or', 'has', 'not',
]);

const SET_OPS = new Set(['every', 'some', 'one', 'lone', 'overall']);

const ATOMS = new Set([
  'ticks', 'tick', 'seconds', 'second', 'true', 'false', 'gt', 'lt', 'eq', 'le', 'ge',
]);

const REF_WORDS = new Set(['label', 'block']);

const FACES = new Set(['top', 'bottom', 'north', 'south', 'east', 'west', 'left', 'right', 'front', 'back', 'side']);

/** 轻量 SFM 语法高亮（CodeMirror StreamLanguage，无需 Lezer 语法文件） */
export const sfmLanguage = StreamLanguage.define<Record<string, never>>({
  name: 'sfm',
  startState: () => ({}),
  token(stream: StringStream): string | null {
    if (stream.match(/--.*/)) return 'comment';
    if (stream.match(/"(?:[^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/\b(?:label|block)\b/)) return 'typeName';
    if (stream.match(/\b(?:top|bottom|north|south|east|west|left|right|front|back|side)\b/)) return 'className';
    if (stream.match(/\b(?:minecraft|sfm|[a-z0-9_]+):[a-z0-9_:]*/i)) return 'variableName';
    if (stream.match(/\b\d+(?:\.\d+)?\b/)) return 'number';

    const word = stream.match(/[A-Za-z_][\w]*/) as RegExpMatchArray | null;
    if (word) {
      const value = word[0];
      if (KEYWORDS.has(value)) return 'keyword';
      if (SET_OPS.has(value)) return 'atom';
      if (ATOMS.has(value)) return 'atom';
      if (REF_WORDS.has(value)) return 'typeName';
      if (FACES.has(value)) return 'className';
      return 'variableName';
    }

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '--' },
    closeBrackets: { brackets: ['(', '[', '{', '"'] },
  },
});
