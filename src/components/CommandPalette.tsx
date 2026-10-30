import {
  Activity,
  BookOpen,
  Gauge,
  History,
  Languages,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  Redo2,
  Play,
  Download,
  HardDriveDownload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../core/store/store';
import { useT } from '../lib/useT';
import type { TranslationKey } from '../lib/i18n';
import type { DialogKind, EditorPanelTab } from './TopBar';
import { cn } from '../lib/utils';

interface CommandItem {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onOpenDialog,
  onOpenPanel,
}: {
  open: boolean;
  onClose: () => void;
  onOpenDialog: (kind: DialogKind) => void;
  onOpenPanel: (tab: EditorPanelTab) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<CommandItem[]>(() => {
    const state = () => useStore.getState();
    const actions: Array<{ key: TranslationKey; icon: LucideIcon; run: () => void }> = [
      { key: 'command.newProject', icon: Plus, run: () => state().createProject() },
      {
        key: 'command.renameProject',
        icon: RefreshCw,
        run: () => {
          const current = state();
          const project = current.projects.find((entry) => entry.id === current.activeProjectId);
          if (!project) return;
          const name = window.prompt(t('project.name'), project.name);
          if (name?.trim()) current.renameProject(project.id, name.trim());
        },
      },
      {
        key: 'command.clearRules',
        icon: Trash2,
        run: () => {
          if (window.confirm(t('rule.clearConfirm'))) state().clearRules();
        },
      },
      {
        key: 'command.toggleTheme',
        icon: Moon,
        run: () => {
          const current = state();
          const order = ['dark', 'light', 'cyber'] as const;
          const index = order.indexOf(current.theme.mode);
          current.setTheme({ mode: order[(index + 1) % order.length] });
        },
      },
      {
        key: 'command.toggleLocale',
        icon: Languages,
        run: () => {
          const current = state();
          current.setLocale(current.settings.locale === 'zh' ? 'en' : 'zh');
        },
      },
      { key: 'command.undo', icon: Undo2, run: () => state().undo() },
      { key: 'command.redo', icon: Redo2, run: () => state().redo() },
      { key: 'command.exportSfm', icon: Download, run: () => state().exportSfm() },
      { key: 'command.exportBackup', icon: HardDriveDownload, run: () => state().exportBackup() },
      { key: 'command.saveSnapshot', icon: Save, run: () => state().saveSnapshot() },
      { key: 'command.openSettings', icon: Settings2, run: () => onOpenDialog('settings') },
      { key: 'command.openAi', icon: Sparkles, run: () => onOpenDialog('ai') },
      { key: 'command.openTopology', icon: Activity, run: () => onOpenPanel('topology') },
      { key: 'command.openPerf', icon: Gauge, run: () => onOpenPanel('perf') },
      { key: 'command.simulate', icon: Play, run: () => onOpenPanel('sim') },
      { key: 'command.docs', icon: BookOpen, run: () => onOpenDialog('syntax') },
      { key: 'command.importBackup', icon: History, run: () => onOpenDialog('settings') },
    ];
    return actions.map((action) => ({
      id: action.key,
      label: t(action.key),
      icon: action.icon,
      keywords: `${action.key} ${t(action.key)}`,
      run: action.run,
    }));
  }, [t, onOpenDialog, onOpenPanel]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (command) => command.label.toLowerCase().includes(needle) || command.keywords.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const view = listRef.current;
    if (!view) return;
    const target = view.querySelector<HTMLElement>(`[data-index="${active}"]`);
    target?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  if (!open) return null;

  const execute = (command: CommandItem | undefined) => {
    if (!command) return;
    command.run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[16vh] animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-overlay shadow-2xl animate-slide-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={13} className="text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, filtered.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                execute(filtered[active]);
              } else if (event.key === 'Escape') {
                onClose();
              }
            }}
            placeholder={t('command.placeholder')}
            className="h-11 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[9px] text-faint">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[10px] text-faint">{t('command.empty')}</p>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  type="button"
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => execute(command)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors',
                    index === active ? 'bg-accent/10 text-accent' : 'text-muted hover:text-ink',
                  )}
                >
                  <Icon size={12} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  <span className="text-[9px] text-faint">↵</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
