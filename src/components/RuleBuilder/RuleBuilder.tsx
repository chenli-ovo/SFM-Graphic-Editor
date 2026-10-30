import { Eraser, Layers } from 'lucide-react';
import { useStore } from '../../core/store/store';
import { useT } from '../../lib/useT';
import { AddRuleMenu, RuleList } from './RuleCard';

export function RuleBuilder() {
  const t = useT();
  const project = useStore((state) => state.projects.find((entry) => entry.id === state.activeProjectId));
  const rules = project?.rules ?? [];
  const { addRule, clearRules, pushToast } = useStore.getState();

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <Layers size={12} className="text-accent" />
        <h2 className="text-[11px] font-semibold tracking-wide text-ink">{t('rule.builderTitle')}</h2>
        <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9px] text-muted">{rules.length}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            if (rules.length === 0) return;
            if (window.confirm(t('rule.clearConfirm'))) {
              clearRules();
              pushToast('info', t('toast.rulesCleared'));
            }
          }}
          className="tip flex items-center gap-1 rounded border border-line px-1.5 py-1 text-[9px] text-muted transition-colors hover:border-danger/40 hover:text-danger"
          data-tip={t('rule.clear')}
        >
          <Eraser size={10} />
          {t('rule.clear')}
        </button>
        <AddRuleMenu onAdd={(type) => addRule(type)} label={t('rule.add')} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {rules.length > 0 ? (
          <RuleList rules={rules} depth={0} parentId={null} bodyKey="body" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line/70 bg-surface/40 p-8 text-center">
            <Layers size={28} className="text-faint" />
            <p className="text-[11px] text-muted">{t('rule.empty.title')}</p>
            <p className="max-w-[220px] text-[10px] leading-relaxed text-faint">{t('rule.empty.body')}</p>
            <AddRuleMenu onAdd={(type) => addRule(type)} label={t('rule.addFirst')} align="left" />
          </div>
        )}
      </div>
    </div>
  );
}
