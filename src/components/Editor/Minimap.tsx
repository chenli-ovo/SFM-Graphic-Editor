import { useEffect, useRef } from 'react';
import type { ThemeMode } from '../../core/types';
import { cn } from '../../lib/utils';

interface MinimapProps {
  code: string;
  mode: ThemeMode;
  onJumpLine: (line: number) => void;
  className?: string;
}

const DARK_BG = '#0b0d10';
const LIGHT_BG = '#eef1f5';
const DARK_LINE = '#2b3038';
const LIGHT_LINE = '#c9d0da';

function lineColor(line: string, dark: boolean): string {
  const text = line.trimStart();
  if (!text) return 'transparent';
  if (text.startsWith('#')) return dark ? '#4b5563' : '#94a3b8';
  if (/^(every|on|if|else|end)\b/.test(text)) return dark ? '#c084fc' : '#7c3aed';
  if (/^input\b/.test(text)) return dark ? '#34d399' : '#059669';
  if (/^output\b/.test(text)) return dark ? '#fbbf24' : '#b45309';
  if (/^(block|tag)\b/.test(text)) return dark ? '#60a5fa' : '#2563eb';
  return dark ? '#6b7280' : '#a3adbb';
}

export function Minimap({ code, mode, onJumpLine, className }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linesRef = useRef<string[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const dark = mode !== 'light';
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (width <= 0 || height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = dark ? DARK_BG : LIGHT_BG;
      ctx.fillRect(0, 0, width, height);

      const lines = code.split('\n');
      linesRef.current = lines;
      const rowHeight = Math.max(1.6, Math.min(3, height / Math.max(lines.length, 1)));
      const baseLine = dark ? DARK_LINE : LIGHT_LINE;

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) continue;
        const y = index * rowHeight;
        if (y > height) break;
        const color = lineColor(line, dark);
        ctx.fillStyle = color === 'transparent' ? baseLine : color;
        const textWidth = Math.min(width - 10, line.trimEnd().length * 1.35 + 2);
        ctx.globalAlpha = color === 'transparent' ? 0.35 : 0.75;
        ctx.fillRect(5, y, textWidth, Math.max(1, rowHeight - 0.8));
      }
      ctx.globalAlpha = 1;
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [code, mode]);

  return (
    <canvas
      ref={canvasRef}
      onClick={(event) => {
        const total = linesRef.current.length;
        if (total === 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
        onJumpLine(Math.max(1, Math.round(ratio * total)));
      }}
      className={cn('block cursor-pointer', className)}
      title="Minimap"
    />
  );
}
