import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseProgram } from '../../../core/parser/parse';
import { buildSimulation } from '../../../core/sim/simulator';
import type { SimulationResult, Tag } from '../../../core/types';
import { useStore } from '../../../core/store/store';
import { useT } from '../../../lib/useT';
import { cn } from '../../../lib/utils';

const EMPTY_TAGS: Tag[] = [];

export function SimulationView({
  code,
  onHighlight,
}: {
  code: string;
  onHighlight: (line: number | null) => void;
}) {
  const t = useT();
  const locale = useStore((state) => state.settings.locale);
  const project = useStore((state) => state.projects.find((entry) => entry.id === state.activeProjectId));
  const tags = project?.tags ?? EMPTY_TAGS;
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const parsed = parseProgram(code, { knownTags: tags.map((tag) => tag.name), locale });
    setResult(buildSimulation(parsed.rules, parsed.ruleLines, locale));
    setCursor(0);
    setPlaying(false);
  }, [code, locale, tags]);

  const events = result?.events ?? [];
  const current = events[cursor] ?? null;

  useEffect(() => {
    onHighlight(current?.line ?? null);
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [current, onHighlight]);

  useEffect(() => () => onHighlight(null), [onHighlight]);

  useEffect(() => {
    if (!playing) return;
    if (events.length === 0) {
      setPlaying(false);
      return;
    }
    if (cursor >= events.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setCursor((value) => Math.min(value + 1, events.length - 1));
    }, 720 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, events.length, speed]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          disabled={events.length === 0}
          className="flex items-center gap-1 rounded border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
        >
          {playing ? <Pause size={10} /> : <Play size={10} />}
          {playing ? t('sim.stop') : t('sim.start')}
        </button>
        <button
          type="button"
          onClick={() => setCursor((value) => Math.min(value + 1, Math.max(events.length - 1, 0)))}
          disabled={events.length === 0}
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          <StepForward size={10} />
          {t('sim.step')}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setCursor(0);
          }}
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] text-muted transition-colors hover:text-ink"
        >
          <RotateCcw size={10} />
          {t('sim.reset')}
        </button>
        <div className="flex-1" />
        <select
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className="h-6 rounded border border-line bg-raised px-1 text-[9px] text-muted outline-none focus:border-accent/50"
        >
          {[0.5, 1, 2, 4].map((value) => (
            <option key={value} value={value}>
              {value}x
            </option>
          ))}
        </select>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-b border-line/60 px-3 py-1 text-[9px] text-faint">
        <span>
          {t('sim.tick', { tick: current?.tick ?? 0 })} / {result?.totalTicks ?? 0}
        </span>
        <span className="text-ok">IN {result?.inputs ?? 0}</span>
        <span className="text-warn">OUT {result?.outputs ?? 0}</span>
        <span className="ml-auto">
          {cursor + 1} / {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <Play size={20} className="text-faint" />
          <p className="text-[10px] text-faint">{t('sim.empty')}</p>
          {result?.warnings.map((warning) => (
            <p key={warning} className="text-[9px] text-warn">
              {warning}
            </p>
          ))}
        </div>
      ) : (
        <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1 font-mono">
          {events.map((event, index) => (
            <li key={index} data-active={index === cursor}>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setCursor(index);
                }}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-0.5 text-left text-[9.5px] leading-relaxed transition-colors',
                  index === cursor ? 'bg-accent/10 text-ink' : 'text-muted hover:bg-raised/60',
                )}
              >
                <span className="w-10 shrink-0 text-right text-faint">{event.tick}</span>
                <span
                  className={cn(
                    'shrink-0 rounded px-1 uppercase',
                    event.kind === 'input' && 'text-ok',
                    event.kind === 'output' && 'text-warn',
                    event.kind === 'if' && 'text-violet-300',
                    event.kind === 'error' && 'bg-danger/15 text-danger',
                    event.kind === 'every' && 'text-cyan-300',
                    event.kind === 'pulse' && 'text-rose-300',
                  )}
                >
                  {event.kind}
                </span>
                <span className="min-w-0 flex-1">{event.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
