import { AlertCircle, AlertTriangle, Info, Wrench } from 'lucide-react';
import type { Diagnostic } from '../../../core/types';
import { useStore } from '../../../core/store/store';
import { useT } from '../../../lib/useT';
import { cn } from '../../../lib/utils';

export function DiagnosticList({
  diagnostics,
  onJump,
}: {
  diagnostics: Diagnostic[];
  onJump: (line: number) => void;
}) {
  const t = useT();
  const { applyTagFixes, pushToast } = useStore.getState();
  const tagFixes = diagnostics.filter((item) => item.fix?.kind === 'define-tag');

  if (diagnostics.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Info size={20} className="text-ok" />
        <p className="text-[11px] text-muted">{t('editor.noIssues')}</p>
        <p className="text-[10px] text-faint">{t('editor.diagnostic.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {tagFixes.length > 0 ? (
        <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
          <span className="text-[10px] text-muted">{t('editor.fixAll')}</span>
          <button
            type="button"
            onClick={() => {
              applyTagFixes();
              pushToast('success', t('toast.saved'));
            }}
            className="flex items-center gap-1 rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[9px] text-warn transition-colors hover:bg-warn/20"
          >
            <Wrench size={9} />
            {t('editor.fixAll')}
          </button>
        </div>
      ) : null}
      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {diagnostics.map((item, index) => {
          const isError = item.severity === 'error';
          const Icon = isError ? AlertCircle : AlertTriangle;
          return (
            <li key={`${item.from}-${index}`}>
              <button
                type="button"
                onClick={() => onJump(item.line)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors hover:bg-raised',
                  isError ? 'text-danger' : 'text-warn',
                )}
              >
                <Icon size={11} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1 text-[10px] leading-relaxed">{item.message}</span>
                <span className="shrink-0 font-mono text-[9px] text-faint">
                  {t('editor.line', { line: item.line })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
