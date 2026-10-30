import type { AccentPreset, ThemeMode, ThemeState } from '../types';

export const ACCENTS: AccentPreset[] = [
  { id: 'emerald', label: '翡翠绿', labelEn: 'Emerald', color: '#34d399' },
  { id: 'cyan', label: '太平洋蓝', labelEn: 'Cyan', color: '#22d3ee' },
  { id: 'violet', label: '星云紫', labelEn: 'Violet', color: '#a78bfa' },
  { id: 'amber', label: '熔金橙', labelEn: 'Amber', color: '#fbbf24' },
  { id: 'rose', label: '玫瑰红', labelEn: 'Rose', color: '#fb7185' },
  { id: 'blue', label: '像素蓝', labelEn: 'Pixel Blue', color: '#60a5fa' },
  { id: 'lime', label: '苦力怕绿', labelEn: 'Creeper Lime', color: '#a3e635' },
  { id: 'fuchsia', label: '末影紫', labelEn: 'End Fuchsia', color: '#e879f9' },
  { id: 'orange', label: '岩浆橙', labelEn: 'Lava Orange', color: '#fb923c' },
  { id: 'teal', label: '深海青', labelEn: 'Deep Teal', color: '#2dd4bf' },
];

export const THEME_MODES: Array<{ id: ThemeMode; zh: string; en: string; icon: string; hintZh: string; hintEn: string }> = [
  { id: 'dark', zh: '深夜极客', en: 'Midnight', icon: '🌙', hintZh: '纯黑背景 + 高对比青绿', hintEn: 'Pure black with high contrast' },
  { id: 'light', zh: '日光工坊', en: 'Daylight', icon: '☀️', hintZh: '明亮纸张质感，适合白天', hintEn: 'Clean paper look for daytime' },
  { id: 'cyber', zh: '赛博朋克', en: 'Cyberpunk', icon: '⚡', hintZh: '霓虹网格 + 扫描线', hintEn: 'Neon grid and scanlines' },
];

export const DEFAULT_THEME: ThemeState = {
  mode: 'dark',
  accent: 'emerald',
  customAccent: '',
};

export function getAccentColor(theme: ThemeState): string {
  if (theme.customAccent && /^#[0-9a-f]{6}$/i.test(theme.customAccent)) return theme.customAccent;
  return ACCENTS.find((a) => a.id === theme.accent)?.color ?? ACCENTS[0].color;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexToRgbTriplet(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

/** 把主题写入 DOM 的 CSS Variables，并同步一份到 localStorage 供首屏脚本使用 */
export function applyTheme(theme: ThemeState): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.mode);
  const color = getAccentColor(theme);
  const { r, g, b } = hexToRgb(color);
  root.style.setProperty('--accent-hex', color);
  root.style.setProperty('--c-accent', `${r} ${g} ${b}`);
  root.style.setProperty('--c-accent-soft', `${r} ${g} ${b}`);
  root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
  try {
    localStorage.setItem('sfm-studio:theme', JSON.stringify(theme));
  } catch {
    /* storage may be full or blocked */
  }
}
