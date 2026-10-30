import {
  Activity,
  AlertCircle,
  Bug,
  CheckCircle2,
  Copy,
  Download,
  Gauge,
  Image,
  Play,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { serializeProgram } from '../../core/parser/serialize';
import { getActiveProject, useStore } from '../../core/store/store';
import type { EditorPanelTab } from '../TopBar';
import { useT } from '../../lib/useT';
import { cn, copyText } from '../../lib/utils';
import { exportCodeImage } from '../../lib/longimage';
import { CodeEditor } from './CodeEditor';
import type { CodeEditorHandle } from './CodeEditor';
import { Minimap } from './Minimap';
import { DiagnosticList } from './panels/DiagnosticList';
import { PerfPanel } from './panels/PerfPanel';
import { SimulationView } from './panels/SimulationView';
import { TopologyView } from './panels/TopologyView';

const TABS: Array<{ id: EditorPanelTab; icon: typeof Activity; labelKey: 'editor.problems' | 'sim.title' | 'topology.title' | 'perf.title' }> = [
  { id: 'diagnostics', icon: AlertCircle, labelKey: 'editor.problems' },
  { id: 'sim', icon: Play, labelKey: 'sim.title' },
  { id: 'topology', icon: Activity, labelKey: 'topology.title' },
  { id: 'perf', icon: Gauge, labelKey: 'perf.title' },
];

export function EditorPanel({
  activePanel,
  onPanelChange,
}: {
  activePanel: EditorPanelTab;
  onPanelChange: (tab: EditorPanelTab) => void;
}) {
  const t = useT();
  const code = useStore((state) => state.code);
  const diagnostics = useStore((state) => state.diagnostics);
  const parseFailed = useStore((state) => state.parseFailed);
  const project = useStore((state) => state.projects.find((entry) => entry.id === state.activeProjectId));
  const settings = useStore((state) => state.settings);
  const theme = useStore((state) => state.theme);
  const revealSeq = useStore((state) => state.revealSeq);
  const { applyCode, forceSyncFromCode, applyTagFixes, exportSfm, pushToast, setBreakpoints } = useStore.getState();

  const editorRef = useRef<CodeEditorHandle>(null);
  const timerRef = useRef<number | null>(null);
  const [simLine, setSimLine] = useState<number | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  const warnings = diagnostics.filter((item) => item.severity === 'warning').length;

  const handleChange = useCallback(
    (next: string) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        useStore.getState().applyCode(next);
      }, 320);
    },
    [],
  );

  const handleCursor = useCallback((line: number, column: number) => {
    setCursor({ line, column });
    const ruleId = useStore.getState().lineToRule[line];
    if (ruleId) useStore.getState().selectRuleFromCode(ruleId);
  }, []);

  const jump = (line: number) => {
    editorRef.current?.jumpToLine(line);
  };

  // 左侧点击卡片 → 右侧滚动并选中该规则对应的代码块。
  // 只在 revealSeq 变化时执行：表单每次输入都会重建 ruleLines，若把它放进依赖，
  // 每次键入都会重新聚焦源码编辑器，抢走标签输入框的焦点。
  const handledReveal = useRef(0);
  useEffect(() => {
    if (revealSeq === 0 || revealSeq === handledReveal.current) return;
    handledReveal.current = revealSeq;
    const state = useStore.getState();
    const id = state.revealRuleId;
    if (!id) return;
    const range = state.ruleLines[id];
    if (!range) return;
    editorRef.current?.revealLine(range.start, range.end);
  }, [revealSeq]);

  const syncBadge = parseFailed ? (
    <span className="flex items-center gap-1 text-danger">
      <AlertCircle size={10} />
      {t('editor.syncError')}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-ok">
      <CheckCircle2 size={10} />
      {t('editor.syncOk')}
    </span>
  );

  return (
    <div className="flex h-full min-w-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
        <span className="text-[10px] font-semibold tracking-wide text-ink">{t('editor.title')}</span>
        <span className="font-mono text-[9px] text-faint">{project?.name}.sfm</span>
        {syncBadge}
        <div className="flex-1" />
        <IconButton
          tip={t('editor.fixAll')}
          onClick={() => {
            applyTagFixes();
            pushToast('success', t('toast.saved'));
          }}
          icon={Wrench}
        />
        <IconButton
          tip={t('editor.format')}
          onClick={() => {
            const current = getActiveProject(useStore.getState());
            if (!current) return;
            applyCode(serializeProgram(current.name, current.rules));
            pushToast('info', t('toast.saved'));
          }}
          icon={Sparkles}
        />
        <IconButton
          tip={t('editor.copy')}
          onClick={async () => {
            await copyText(code);
            pushToast('success', t('toast.copied'));
          }}
          icon={Copy}
        />
        <IconButton
          tip={t('editor.exportLongImage')}
          onClick={() => {
            exportCodeImage(code, project?.name ?? 'SFM');
            pushToast('success', t('toast.exported'));
          }}
          icon={Image}
        />
        <IconButton
          tip={t('editor.syncToForm')}
          onClick={() => {
            forceSyncFromCode();
            pushToast('info', parseFailed ? t('toast.parseError') : t('toast.saved'));
          }}
          icon={RefreshCw}
        />
        <IconButton tip={t('toolbar.exportSfm')} onClick={() => exportSfm()} icon={Download} />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <CodeEditor
            ref={editorRef}
            code={code}
            mode={theme.mode}
            accent={theme.accent}
            simLine={simLine}
            onChange={handleChange}
            onCursor={handleCursor}
            onBreakpoints={(lines) => setBreakpoints(lines)}
          />
        </div>
        {settings.showMinimap ? (
          <div className="w-[64px] shrink-0 border-l border-line/60 bg-app/60">
            <Minimap code={code} mode={theme.mode} onJumpLine={jump} className="h-full" />
          </div>
        ) : null}
      </div>

      <div className="flex h-[40%] min-h-[240px] max-h-[420px] shrink-0 flex-col border-t border-line">
        <div className="flex shrink-0 items-center gap-0.5 border-b border-line/70 px-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activePanel === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onPanelChange(tab.id)}
                className={cn(
                  'flex items-center gap-1 border-b-2 px-2 py-1.5 text-[9.5px] transition-colors',
                  active ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink',
                )}
              >
                <Icon size={10} />
                {t(tab.labelKey)}
                {tab.id === 'diagnostics' && errors + warnings > 0 ? (
                  <span className={cn('rounded-full px-1 text-[8px]', errors > 0 ? 'bg-danger/20 text-danger' : 'bg-warn/20 text-warn')}>
                    {errors + warnings}
                  </span>
                ) : null}
              </button>
            );
          })}
          <div className="flex-1" />
          <span className="pr-1 text-[8px] text-faint">{t('editor.breakpointHint')}</span>
        </div>

        <div className="min-h-0 flex-1">
          {activePanel === 'diagnostics' ? <DiagnosticList diagnostics={diagnostics} onJump={jump} /> : null}
          {activePanel === 'sim' ? (
            <SimulationView
              code={code}
              onHighlight={(line) => {
                setSimLine(line);
              }}
            />
          ) : null}
          {activePanel === 'topology' ? <TopologyView /> : null}
          {activePanel === 'perf' ? <PerfPanel /> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-line/70 px-3 py-0.5 text-[9px] text-faint">
        <span className="flex items-center gap-1">
          <Bug size={9} />
          {errors} / {warnings}
        </span>
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span>{t('editor.readonly')}</span>
        <span className="ml-auto">{t('editor.foldHint')}</span>
      </div>
    </div>
  );
}

function IconButton({
  tip,
  onClick,
  icon: Icon,
}: {
  tip: string;
  onClick: () => void;
  icon: typeof Activity;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tip rounded border border-transparent p-1 text-faint transition-colors hover:border-line hover:text-ink"
      data-tip={tip}
      aria-label={tip}
    >
      <Icon size={11} />
    </button>
  );
}
