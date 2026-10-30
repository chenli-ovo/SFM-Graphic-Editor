import { downloadBlob, safeFileName } from './utils';

interface Token {
  text: string;
  color: string;
}

const KEYWORDS = new Set([
  'name', 'every', 'ticks', 'tick', 'seconds', 'second', 'do', 'end', 'on', 'pulse', 'any',
  'rising', 'falling', 'input', 'output', 'from', 'to', 'slots', 'slot', 'if', 'then', 'else',
  'not', 'and', 'or', 'has', 'redstone', 'side', 'each', 'retain', 'except', 'with', 'without',
  'round', 'robin', 'by', 'label', 'block', 'global', 'g', 'empty', 'in', 'forget', 'true',
  'false', 'every', 'some', 'one', 'lone', 'overall', 'gt', 'lt', 'eq', 'le', 'ge',
]);

const COLORS = {
  bg: '#0b0d10',
  panel: '#101318',
  ink: '#d7dae0',
  faint: '#5b6472',
  keyword: '#c084fc',
  string: '#4ade80',
  number: '#fbbf24',
  comment: '#5c6673',
  ref: '#60a5fa',
  accent: '#34d399',
};

function accentColor(): string {
  if (typeof window === 'undefined') return COLORS.accent;
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent-hex').trim();
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : COLORS.accent;
}

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(#.*$)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w.:-]*)|(\s+)|([^\s\w"#]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line))) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), color: COLORS.ink });
    }
    const [raw, comment, str, num, word, space] = match;
    if (comment) tokens.push({ text: raw, color: COLORS.comment });
    else if (str) tokens.push({ text: raw, color: COLORS.string });
    else if (num) tokens.push({ text: raw, color: COLORS.number });
    else if (word) {
      const lower = word.toLowerCase();
      const color = lower === 'block' || lower === 'tag'
        ? COLORS.ref
        : KEYWORDS.has(lower)
          ? COLORS.keyword
          : COLORS.ink;
      tokens.push({ text: raw, color });
    } else if (space) tokens.push({ text: raw, color: COLORS.ink });
    else tokens.push({ text: raw, color: COLORS.faint });
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < line.length) tokens.push({ text: line.slice(lastIndex), color: COLORS.ink });
  return tokens;
}

/** 把代码渲染成一张高清 PNG 长图并下载 */
export async function exportCodeImage(code: string, title: string): Promise<void> {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const width = 1120;
  const padding = 40;
  const headerHeight = 92;
  const lineHeight = lines.length > 120 ? 18 : 22;
  const fontSize = lines.length > 120 ? 12 : 14;
  const maxBodyHeight = 15000 - headerHeight;
  const visibleLines = Math.min(lines.length, Math.floor(maxBodyHeight / lineHeight));
  const bodyHeight = visibleLines * lineHeight + padding;
  const height = headerHeight + bodyHeight + (visibleLines < lines.length ? 36 : 0);

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.scale(dpr, dpr);

  const accent = accentColor();

  // 背景
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  // 顶栏
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(0, 0, width, headerHeight);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 4, headerHeight);
  ctx.font = `600 20px 'JetBrains Mono', 'Cascadia Code', Consolas, 'Microsoft YaHei', monospace`;
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(title.endsWith('.sfm') ? title : `${title}.sfm`, padding, 44);
  ctx.font = `12px 'JetBrains Mono', Consolas, 'Microsoft YaHei', monospace`;
  ctx.fillStyle = COLORS.faint;
  ctx.fillText(
    `SFM Studio · Super Factory Manager · ${new Date().toLocaleString()} · ${lines.length} lines`,
    padding,
    68,
  );

  // 行号
  const gutterWidth = 52;
  ctx.font = `${fontSize}px 'JetBrains Mono', 'Cascadia Code', Consolas, 'Microsoft YaHei', monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.faint;
  const digitWidth = ctx.measureText('0').width;
  for (let index = 0; index < visibleLines; index += 1) {
    const y = headerHeight + padding / 2 + index * lineHeight + lineHeight / 2;
    const label = String(index + 1);
    ctx.fillText(label, gutterWidth - 12 - label.length * digitWidth, y);
  }

  // 分隔线
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gutterWidth, headerHeight);
  ctx.lineTo(gutterWidth, headerHeight + bodyHeight);
  ctx.stroke();

  // 代码
  for (let index = 0; index < visibleLines; index += 1) {
    const y = headerHeight + padding / 2 + index * lineHeight + lineHeight / 2;
    let x = gutterWidth + 18;
    for (const token of tokenize(lines[index])) {
      ctx.fillStyle = token.color;
      ctx.fillText(token.text, x, y);
      x += ctx.measureText(token.text).width;
    }
  }

  if (visibleLines < lines.length) {
    ctx.fillStyle = COLORS.faint;
    ctx.font = `12px 'JetBrains Mono', Consolas, 'Microsoft YaHei', monospace`;
    ctx.fillText(`… ${lines.length - visibleLines} more lines truncated`, gutterWidth + 18, height - 20);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) downloadBlob(`${safeFileName(title)}.png`, blob);
}
