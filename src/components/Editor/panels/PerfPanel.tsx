import { AlertTriangle, Gauge } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { analyzePerformance } from '../../../core/analysis/perf';
import { analyzeTopology } from '../../../core/analysis/topology';
import { useStore } from '../../../core/store/store';
import { useT } from '../../../lib/useT';

const SIZE = 260;

export function PerfPanel() {
  const t = useT();
  const locale = useStore((state) => state.settings.locale);
  const accent = useStore((state) => state.theme.accent);
  const project = useStore((state) => state.projects.find((entry) => entry.id === state.activeProjectId));
  const rules = project?.rules ?? [];
  const tags = project?.tags ?? [];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cycleCount = useMemo(
    () => analyzeTopology(rules, tags, locale).warnings.filter((warning) => warning.kind === 'cycle').length,
    [rules, tags, locale],
  );
  const report = useMemo(() => analyzePerformance(rules, locale, { cycleCount }), [rules, locale, cycleCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const center = SIZE / 2;
    const radius = SIZE * 0.32;
    const count = report.metrics.length;
    const angleFor = (index: number) => (index / count) * Math.PI * 2 - Math.PI / 2;
    const pointFor = (index: number, value: number) => {
      const angle = angleFor(index);
      const ratio = Math.max(0, Math.min(100, value)) / 100;
      return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio] as const;
    };

    for (let level = 4; level >= 1; level -= 1) {
      ctx.beginPath();
      for (let index = 0; index < count; index += 1) {
        const angle = angleFor(index);
        const point = [center + Math.cos(angle) * (radius * level) / 4, center + Math.sin(angle) * (radius * level) / 4];
        if (index === 0) ctx.moveTo(point[0], point[1]);
        else ctx.lineTo(point[0], point[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = level === 4 ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    for (let index = 0; index < count; index += 1) {
      const angle = angleFor(index);
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
      ctx.stroke();
    }

    ctx.beginPath();
    report.metrics.forEach((metric, index) => {
      const [x, y] = pointFor(index, metric.value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-hex').trim() || '#34d399';
    ctx.fillStyle = `${accentColor}2e`;
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    report.metrics.forEach((metric, index) => {
      const [x, y] = pointFor(index, metric.value);
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
    });

    ctx.font = '9px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    report.metrics.forEach((metric, index) => {
      const angle = angleFor(index);
      const label = t(`perf.radar.${metric.label}` as 'perf.radar.speed');
      ctx.fillText(label, center + Math.cos(angle) * (radius + 20), center + Math.sin(angle) * (radius + 20));
    });
  }, [report, accent, locale, t]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
        <Gauge size={11} className="text-accent" />
        <span className="text-[10px] font-medium text-ink">{t('perf.title')}</span>
        <div className="flex-1" />
        <span className="rounded bg-raised px-1.5 py-0.5 text-[9px] text-muted">
          {t('perf.estimate')}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex flex-wrap items-start gap-3">
          <canvas ref={canvasRef} className="shrink-0" />
          <div className="min-w-[150px] flex-1 space-y-1.5">
            {[
              { label: t('perf.peak'), value: `${report.peakTps}`, unit: t('perf.unit.perSec') },
              { label: t('perf.tps'), value: `${report.ticksPerSecond}`, unit: t('perf.unit.perTick') },
              { label: t('perf.load'), value: `${report.totalRules}`, unit: '' },
              { label: 'EVERY TICK', value: `${report.everyTickRules}`, unit: '' },
            ].map((item) => (
              <div key={item.label} className="flex items-baseline justify-between rounded border border-line/60 bg-raised/40 px-2 py-1">
                <span className="text-[9px] text-faint">{item.label}</span>
                <span className="font-mono text-[11px] text-ink">
                  {item.value}
                  {item.unit ? <span className="ml-1 text-[8px] text-faint">{item.unit}</span> : null}
                </span>
              </div>
            ))}
            <div className="flex items-baseline justify-between rounded border border-accent/30 bg-accent/5 px-2 py-1">
              <span className="text-[9px] text-muted">{t('perf.title')}</span>
              <span className="font-mono text-[13px] text-accent">{report.score}</span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-faint">{t('perf.warning')}</p>
          {report.warnings.length === 0 ? (
            <p className="text-[10px] text-ok">{t('perf.ok')}</p>
          ) : (
            <ul className="space-y-1">
              {report.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-warn">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 border-t border-line/60 pt-2 text-[9px] text-faint">
          {report.totalRules} rules · {tags.length} tags · {cycleCount} cycles
        </div>
      </div>
    </div>
  );
}
