import { Eraser, Layers, Replace, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { searchRules } from '../../core/rules/search';
import type { ReplaceMode } from '../../core/rules/search';
import { countRules } from '../../core/rules/tree';
import { useStore } from '../../core/store/store';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';
import { AddRuleMenu, RuleList } from './RuleCard';

export function RuleBuilder() {
  const t = useT();
  const project = useStore((state) => state.projects.find((entry) => entry.id === state.activeProjectId));
  const rules = project?.rules ?? [];
  const { addRule, clearRules, replaceAll, pushToast } = useStore.getState();

  const [query, setQuery] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [mode, setMode] = useState<ReplaceMode>('tag');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  const filtered = useMemo(() => searchRules(rules, query), [rules, query]);
  const total = countRules(rules);
  const matched = query.trim() ? countRules(filtered) : total;

  const applyReplace = () => {
    const count = replaceAll(mode, findText, replaceText);
    if (count > 0) {
      pushToast('success', t('rule.replaceDone', { count }));
      setFindText('');
    } else {
      pushToast('warning', t('rule.replaceNone'));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <Layers size={12} className="text-accent" />
        <h2 className="text-[11px] font-semibold tracking-wide text-ink">{t('rule.builderTitle')}</h2>
        <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9px] text-muted">{total}</span>
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

      <div className="flex shrink-0 items-center gap-1.5 border-b border-line/60 px-2 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search size={11} className="pointer-events-none absolute left-2 top-2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('rule.search')}
            className="h-7 w-full rounded-md border border-line bg-raised pl-6 pr-6 text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1.5 rounded p-0.5 text-faint hover:text-ink"
              aria-label={t('rule.clearSearch')}
            >
              <X size={11} />
            </button>
          ) : null}
        </div>
        {query.trim() ? (
          <span className="shrink-0 rounded-full bg-raised px-1.5 py-0.5 text-[9px] text-muted">
            {t('rule.searchCount', { count: matched })}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setReplaceOpen((value) => !value)}
          className={cn(
            'tip flex h-7 shrink-0 items-center gap-1 rounded border px-1.5 text-[9px] transition-colors',
            replaceOpen
              ? 'border-accent/50 bg-accent/10 text-accent'
              : 'border-line text-muted hover:border-accent/40 hover:text-accent',
          )}
          data-tip={t('rule.replace')}
        >
          <Replace size={10} />
          {t('rule.replace')}
        </button>
      </div>

      {replaceOpen ? (
        <div className="shrink-0 space-y-1.5 border-b border-line/60 bg-raised/40 px-2 py-2">
          <div className="flex items-center gap-1.5">
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as ReplaceMode)}
              className="h-6 shrink-0 rounded-md border border-line bg-surface px-1 text-[9px] text-ink outline-none focus:border-accent/50"
            >
              <option value="tag">{t('rule.replaceModeTag')}</option>
              <option value="item">{t('rule.replaceModeItem')}</option>
            </select>
            <input
              value={findText}
              onChange={(event) => setFindText(event.target.value)}
              placeholder={t('rule.find')}
              className="h-6 min-w-0 flex-1 rounded-md border border-line bg-surface px-1.5 font-mono text-[9px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <span className="shrink-0 text-[9px] text-faint">→</span>
            <input
              value={replaceText}
              onChange={(event) => setReplaceText(event.target.value)}
              placeholder={t('rule.replaceWith')}
              className="h-6 min-w-0 flex-1 rounded-md border border-line bg-surface px-1.5 font-mono text-[9px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <button
              type="button"
              onClick={applyReplace}
              className="h-6 shrink-0 rounded-md bg-accent/15 px-2 text-[9px] font-medium text-accent transition-colors hover:bg-accent/25"
            >
              {t('rule.replaceAll')}
            </button>
          </div>
          <p className="text-[8px] leading-relaxed text-faint">{t('rule.replaceHint')}</p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {rules.length > 0 ? (
          filtered.length > 0 ? (
            <RuleList rules={filtered} depth={0} parentId={null} bodyKey="body" />
          ) : (
            <p className="px-2 py-6 text-center text-[11px] text-faint">{t('rule.searchCount', { count: 0 })}</p>
          )
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
