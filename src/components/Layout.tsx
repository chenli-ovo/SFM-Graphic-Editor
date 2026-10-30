import { Activity, AlertTriangle, CircleDot, Command, PanelLeftOpen } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useActiveProject, useStore } from '../core/store/store';
import { countRules } from '../core/rules/tree';
import { THEME_MODES } from '../core/data/themes';
import { useT } from '../lib/useT';
import { Sidebar } from './Sidebar/Sidebar';
import { RuleBuilder } from './RuleBuilder/RuleBuilder';
import { EditorPanel } from './Editor/EditorPanel';
import { TopBar } from './TopBar';
import type { DialogKind, EditorPanelTab } from './TopBar';

export function Layout({
  onOpenDialog,
  onOpenPalette,
  panel,
  onPanelChange,
}: {
  onOpenDialog: (kind: DialogKind) => void;
  onOpenPalette: () => void;
  panel: EditorPanelTab;
  onPanelChange: Dispatch<SetStateAction<EditorPanelTab>>;
}) {
  const t = useT();
  const project = useActiveProject();
  const hydrated = useStore((state) => state.hydrated);
  const diagnostics = useStore((state) => state.diagnostics);
  const parseFailed = useStore((state) => state.parseFailed);
  const theme = useStore((state) => state.theme);
  const locale = useStore((state) => state.settings.locale);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useStore((state) => state.toggleSidebar);

  const errors = diagnostics.filter((entry) => entry.severity === 'error').length;
  const warnings = diagnostics.length - errors;
  const mode = THEME_MODES.find((entry) => entry.id === theme.mode);

  if (!hydrated || !project) {
    return (
      <div className="flex h-screen items-center justify-center bg-app text-muted">
        <div className="flex flex-col items-center gap-3">
          <CircleDot size={20} className="animate-pulse-soft text-accent" />
          <p className="font-mono text-[10px] tracking-[0.24em] uppercase">{t('app.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-app text-ink">
      <TopBar onOpenDialog={onOpenDialog} onOpenPalette={onOpenPalette} onOpenPanel={onPanelChange} />

      <div className="relative flex min-h-0 flex-1">
        <Sidebar />
        {sidebarCollapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            data-tip={t('sidebar.expand')}
            className="tip-right absolute left-1.5 top-3 z-30 flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-muted shadow-card transition-colors hover:border-accent/40 hover:text-accent"
          >
            <PanelLeftOpen size={13} />
          </button>
        ) : null}

        <main className="flex min-w-0 flex-1">
          <section className={`min-w-[340px] flex-[0_0_46%] overflow-y-auto border-r border-line bg-app/60 ${sidebarCollapsed ? 'pl-9' : ''}`}>
            <RuleBuilder />
          </section>
          <section className="min-w-[420px] flex-1">
            <EditorPanel activePanel={panel} onPanelChange={onPanelChange} />
          </section>
        </main>
      </div>

      <footer className="flex h-6 shrink-0 items-center gap-0 border-t border-line bg-surface px-3 font-mono text-[9px] text-faint">
        <span className="flex items-center gap-1 text-muted">
          <Activity size={9} className="text-accent" />
          {project.name}
        </span>
        <span className="mx-2 text-line">│</span>
        <span>{t('toolbar.rules', { count: countRules(project.rules) })}</span>
        <span className="mx-2 text-line">│</span>
        <span className={errors > 0 ? 'text-danger' : 'text-ok'}>
          {t('editor.errors', { count: errors })}
        </span>
        <span className="mx-1 text-line">/</span>
        <span className={warnings > 0 ? 'text-warn' : 'text-faint'}>
          {t('editor.warnings', { count: warnings })}
        </span>
        {parseFailed ? (
          <>
            <span className="mx-2 text-line">│</span>
            <span className="flex items-center gap-1 text-warn">
              <AlertTriangle size={9} />
              {t('editor.parseFailed')}
            </span>
          </>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          <span className="text-faint">{locale === 'zh' ? '中文' : 'EN'}</span>
          <span className="text-line">│</span>
          <span>{locale === 'zh' ? mode?.zh : mode?.en}</span>
          <span className="text-line">│</span>
          <span className="flex items-center gap-1">
            <Command size={9} />
            Ctrl+K
          </span>
        </span>
      </footer>
    </div>
  );
}
