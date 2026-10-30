import { foldService } from '@codemirror/language';

function isBlockStart(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('--')) return false;
  return /^(every\b|if\b)/i.test(trimmed) && /\b(do|then)\s*$/i.test(trimmed);
}

function isEnd(text: string): boolean {
  return /^end\b/i.test(text.trim());
}

/**
 * 折叠 every / if 块：从块首行折到与之匹配的 end 行。
 */
export const sfmFoldService = foldService.of((state, lineStart): { from: number; to: number } | null => {
  const line = state.doc.lineAt(lineStart);
  if (!isBlockStart(line.text)) return null;

  let depth = 0;
  for (let number = line.number + 1; number <= state.doc.lines; number++) {
    const current = state.doc.line(number);
    const text = current.text.trim();
    if (!text || text.startsWith('--')) continue;
    if (isBlockStart(text)) {
      depth++;
    } else if (isEnd(text)) {
      if (depth === 0) {
        const to = current.from - 1;
        return to > line.to ? { from: line.to, to } : null;
      }
      depth--;
    }
  }
  return null;
});
