import {
  BookOpen,
  Boxes,
  BrainCircuit,
  Command,
  Download,
  FileClock,
  Gauge,
  Moon,
  Network,
  Pencil,
  Play,
  Redo2,
  Save,
  Settings2,
  Share2,
  Sun,
  Undo2,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useStore } from '../core/store/store';
import { THEME_MODES } from '../core/data/themes';
import { playSound } from '../lib/audio';
import { useT } from '../lib/useT';
import { cn } from '../lib/utils';

export type DialogKind = 'settings' | 'history' | 'ai' | 'syntax';

export type EditorPanelTab = 'diagnostics' | 'sim' | 'topology' | 'perf';

interface TopBarProps {
  onOpenDialog: (kind: DialogKind) => void;
  onOpenPalette: () => void;
  onOpenPanel: (tab: EditorPanelTab) => void;
}

function ToolButton({
  label,
  icon,
  onClick,
  disabled,
  active,
  accent,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tip={label}
      className={cn(
        'tip flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted transition-all',
        'hover:border-line hover:bg-raised hover:text-ink',
        active && 'border-accent/30 bg-accent/10 text-accent',
        accent && 'text-accent',
        disabled && 'cursor-not-allowed opacity-35 hover:border-transparent hover:bg-transparent hover:text-muted',
      )}
    >
      {icon}
    </button>
  );
}

export function TopBar({ onOpenDialog, onOpenPalette, onOpenPanel }: TopBarProps) {
  const t = useT();
  const projects = useStore((state) => state.projects);
  const activeProjectId = useStore((state) => state.activeProjectId);
  const activeName = useStore((state) => state.projects.find((p) => p.id === state.activeProjectId)?.name ?? '');
  const theme = useStore((state) => state.theme);
  const canUndo = useStore((state) => state.past.length > 0);
  const canRedo = useStore((state) => state.future.length > 0);
  const { setActiveProject, createProject, undo, redo, saveSnapshot, setTheme, setLocale, exportSfm, shareProject, copyGiveCommand } =
    useStore.getState();

  const modeIndex = THEME_MODES.findIndex((mode) => mode.id === theme.mode);
  const nextMode = THEME_MODES[(modeIndex + 1) % THEME_MODES.length];
  const modeInfo = THEME_MODES[modeIndex];

  const locale = useStore((state) => state.settings.locale);

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
      <div className="flex items-center gap-2.5 pr-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent shadow-glow">
          <Boxes size={17} />
        </div>
        <div className="leading-none">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold tracking-wide text-ink">{t('app.name')}</span>
            <span className="rounded-sm border border-accent/30 bg-accent/10 px-1 py-px text-[8px] font-semibold tracking-widest text-accent">
              {t('app.beta')}
            </span>
          </div>
          <div className="mt-1 hidden text-[10px] text-faint lg:block">{t('app.tagline')}</div>
        </div>
      </div>

      <div className="h-6 w-px bg-line" />

      <div className="flex items-center gap-1.5">
        <div className="relative">
          <select
            value={activeProjectId}
            onChange={(event) => {
              setActiveProject(event.target.value);
              playSound('toggle');
            }}
            className="h-8 max-w-[190px] appearance-none truncate rounded-md border border-line bg-raised pl-2.5 pr-7 text-xs font-medium text-ink outline-none transition-colors hover:border-accent/40 focus:border-accent/60"
            title={t('project.label')}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <Pencil size={11} className="pointer-events-none absolute right-2 top-2.5 text-faint" />
        </div>
        <button
          type="button"
          onClick={() => {
            createProject();
            playSound('toggle');
          }}
          className="tip flex h-8 items-center gap-1.5 rounded-md border border-line bg-raised px-2 text-[11px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink"
          data-tip={t('project.new')}
        >
          + {t('project.new')}
        </button>
      </div>

      <div className="h-6 w-px bg-line" />

      <div className="flex items-center gap-0.5">
        <ToolButton label={t('toolbar.undo')} icon={<Undo2 size={15} />} onClick={undo} disabled={!canUndo} />
        <ToolButton label={t('toolbar.redo')} icon={<Redo2 size={15} />} onClick={redo} disabled={!canRedo} />
        <ToolButton
          label={t('toolbar.snapshot')}
          icon={<Save size={15} />}
          onClick={() => {
            saveSnapshot();
            playSound('success');
          }}
        />
        <ToolButton label={t('toolbar.history')} icon={<FileClock size={15} />} onClick={() => onOpenDialog('history')} />
        <div className="mx-1 h-5 w-px bg-line" />
        <ToolButton label={t('toolbar.simulate')} icon={<Play size={15} />} onClick={() => onOpenPanel('sim')} />
        <ToolButton label={t('toolbar.topology')} icon={<Network size={15} />} onClick={() => onOpenPanel('topology')} />
        <ToolButton label={t('toolbar.analyze')} icon={<Gauge size={15} />} onClick={() => onOpenPanel('perf')} />
        <ToolButton label={t('toolbar.ai')} icon={<BrainCircuit size={15} />} onClick={() => onOpenDialog('ai')} accent />
      </div>

      <div className="flex-1" />

      <div className="hidden items-center gap-1.5 xl:flex">
        <span className="text-[10px] text-faint">{activeName}</span>
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        className="flex h-8 items-center gap-2 rounded-md border border-line bg-raised px-2.5 text-[11px] text-faint transition-colors hover:border-accent/40 hover:text-muted"
      >
        <Command size={12} />
        <span className="hidden md:inline">{t('toolbar.commands')}</span>
        <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[9px]">Ctrl K</kbd>
      </button>

      <button
        type="button"
        onClick={() => {
          setTheme({ mode: nextMode.id });
          playSound('toggle');
        }}
        className="tip flex h-8 items-center gap-1.5 rounded-md border border-line bg-raised px-2 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-ink"
        data-tip={t('theme.title')}
      >
        {nextMode.id === 'light' ? <Sun size={13} /> : nextMode.id === 'cyber' ? <Zap size={13} /> : <Moon size={13} />}
        <span className="hidden lg:inline">{modeInfo ? (locale === 'zh' ? modeInfo.zh : modeInfo.en) : ''}</span>
      </button>

      <ToolButton
        label={t('theme.language')}
        icon={<span className="text-[11px] font-bold">{locale === 'zh' ? '中' : 'EN'}</span>}
        onClick={() => {
          setLocale(locale === 'zh' ? 'en' : 'zh');
          playSound('toggle');
        }}
      />

      <ToolButton
        label={t('toolbar.exportSfm')}
        icon={<Download size={15} />}
        onClick={() => {
          exportSfm();
          playSound('success');
        }}
      />

      <ToolButton
        label={t('toolbar.share')}
        icon={<Share2 size={15} />}
        onClick={() => {
          void shareProject();
          playSound('success');
        }}
      />

      <ToolButton
        label={t('toolbar.give')}
        icon={<BookOpen size={15} />}
        onClick={() => {
          void copyGiveCommand();
          playSound('success');
        }}
      />

      <ToolButton label={t('toolbar.settings')} icon={<Settings2 size={15} />} onClick={() => onOpenDialog('settings')} />
    </header>
  );
}
