import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eraser,
  GripVertical,
  LayoutTemplate,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { summarizeRule } from '../../core/parser/serialize';
import { defaultHasExpr, findSiblings } from '../../core/rules/tree';
import type { BodyKey } from '../../core/rules/tree';
import { useStore } from '../../core/store/store';
import type { BoolExpr, ElseIfClause, IfRule, Rule, RuleType } from '../../core/types';
import { RULE_TYPES } from '../../core/types';
import { newId } from '../../lib/id';
import { getDraggingRule, moveArrayItem, setDraggingRule } from '../../lib/rule-drag';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';
import { ExprInput, IoOpsEditor, LabelsInput, SidesEditor } from './fields';

const TYPE_ICONS: Record<RuleType, LucideIcon> = {
  every: Timer,
  pulse: Zap,
  input: ArrowDown,
  output: ArrowUp,
  if: ChevronDown,
  forget: Eraser,
};

const TYPE_TONE: Record<RuleType, string> = {
  every: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  pulse: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  input: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  output: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  if: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  forget: 'border-slate-400/30 bg-slate-400/10 text-slate-300',
};

function emptyLabel(labels: string[]): boolean {
  return labels.length === 0 || labels.some((label) => !label.trim() || label === '?');
}

function exprHasError(expr: BoolExpr): boolean {
  switch (expr.kind) {
    case 'not':
      return exprHasError(expr.expr);
    case 'and':
    case 'or':
      return exprHasError(expr.left) || exprHasError(expr.right);
    case 'has':
      return expr.value === null || emptyLabel(expr.labels);
    default:
      return false;
  }
}

function ruleHasError(rule: Rule): boolean {
  switch (rule.type) {
    case 'every':
      return !rule.interval || rule.interval <= 0;
    case 'pulse':
      return false;
    case 'input':
    case 'output':
      return emptyLabel(rule.labels);
    case 'if':
      return exprHasError(rule.condition) || rule.elifs.some((clause) => exprHasError(clause.condition));
    case 'forget':
      return false;
  }
}

export function AddRuleMenu({
  onAdd,
  label,
  align = 'right',
}: {
  onAdd: (type: RuleType) => void;
  label: string;
  align?: 'left' | 'right';
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex items-center gap-1 rounded border border-line bg-raised px-1.5 py-0.5 text-[9px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
      >
        + {label}
      </button>
      {open ? (
        <div
          className={cn(
            'absolute top-full z-50 mt-1 w-40 rounded-md border border-line bg-overlay p-1 shadow-xl animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {RULE_TYPES.map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAdd(type);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] text-muted transition-colors hover:bg-raised hover:text-ink"
              >
                <Icon size={11} />
                {t(`rule.type.${type}`)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function RuleList({
  rules,
  depth,
  parentId,
  bodyKey,
}: {
  rules: Rule[];
  depth: number;
  parentId: string | null;
  bodyKey: BodyKey;
}) {
  return (
    <div className="space-y-1.5">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} depth={depth} parentId={parentId} bodyKey={bodyKey} />
      ))}
    </div>
  );
}

export function RuleCard({
  rule,
  depth,
  parentId,
  bodyKey,
}: {
  rule: Rule;
  depth: number;
  parentId: string | null;
  bodyKey: BodyKey;
}) {
  const t = useT();
  const project = useStore((state) => state.projects.find((entry) => entry.id === state.activeProjectId));
  const selected = useStore((state) => state.selectedRuleId === rule.id);
  const selectSeq = useStore((state) => state.selectSeq);
  const { updateRule, removeRule, duplicateRule, moveRule, toggleCollapse, revealRule, reorderRules } =
    useStore.getState();

  const cardRef = useRef<HTMLDivElement | null>(null);
  const setCardRef = useCallback((node: HTMLDivElement | null) => {
    cardRef.current = node;
  }, []);
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (selectSeq === 0 || !selected) return;
    cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectSeq, selected]);

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setDraggingRule(rule.id);
    setDragging(true);
    event.dataTransfer.setData('text/plain', `rule:${rule.id}`);
    event.dataTransfer.effectAllowed = 'move';
    const card = cardRef.current;
    if (card) event.dataTransfer.setDragImage(card, 28, 18);
  };

  const handleDragEnd = () => {
    setDraggingRule(null);
    setDragging(false);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    const activeId = getDraggingRule();
    if (!activeId || activeId === rule.id) return;
    const rules = project?.rules ?? [];
    const activeSiblings = findSiblings(rules, activeId);
    const overSiblings = findSiblings(rules, rule.id);
    if (!activeSiblings || !overSiblings || activeSiblings !== overSiblings) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    setDragOver(false);
    const activeId = getDraggingRule();
    if (!activeId) return;
    event.preventDefault();
    event.stopPropagation();
    if (activeId === rule.id) return;
    const rules = project?.rules ?? [];
    const activeSiblings = findSiblings(rules, activeId);
    const overSiblings = findSiblings(rules, rule.id);
    const from = activeSiblings ? activeSiblings.findIndex((entry) => entry.id === activeId) : -2;
    const to = overSiblings ? overSiblings.findIndex((entry) => entry.id === rule.id) : -2;
    if (!activeSiblings || !overSiblings || activeSiblings !== overSiblings) return;
    if (from < 0 || to < 0) return;
    reorderRules(activeSiblings, moveArrayItem(activeSiblings, from, to));
  };

  const Icon = TYPE_ICONS[rule.type];
  const tags = project?.tags ?? [];
  const items = project?.items ?? [];
  const hasError = ruleHasError(rule);
  const collapsed = rule.collapsed;
  const patch = (value: Partial<Rule>) => updateRule(rule.id, value);

  const ifRule = rule.type === 'if' ? (rule as IfRule) : null;
  const addElif = () => {
    if (!ifRule) return;
    const clause: ElseIfClause = { id: newId('elif'), condition: defaultHasExpr(), body: [] };
    patch({ elifs: [...ifRule.elifs, clause] } as Partial<Rule>);
  };
  const removeElif = (clauseId: string) => {
    if (!ifRule) return;
    patch({ elifs: ifRule.elifs.filter((clause) => clause.id !== clauseId) } as Partial<Rule>);
  };
  const updateElif = (clauseId: string, condition: BoolExpr) => {
    if (!ifRule) return;
    patch({
      elifs: ifRule.elifs.map((clause) => (clause.id === clauseId ? { ...clause, condition } : clause)),
    } as Partial<Rule>);
  };

  return (
    <div
      ref={setCardRef}
      onClick={() => revealRule(rule.id)}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'group relative rounded-lg border bg-surface transition-colors',
        selected ? 'border-accent/60 ring-1 ring-accent/15' : 'border-line hover:border-line/90',
        hasError && !selected && 'border-danger/35',
        dragging && 'opacity-50',
        dragOver && 'border-accent/70 ring-1 ring-accent/40',
        depth > 0 && 'bg-surface/80',
      )}
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={(event) => event.stopPropagation()}
          className="tip cursor-grab select-none rounded p-0.5 text-faint transition-colors hover:text-muted active:cursor-grabbing"
          data-tip={t('rule.drag')}
        >
          <GripVertical size={12} />
        </button>
        <span className={cn('flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium', TYPE_TONE[rule.type])}>
          <Icon size={9} />
          {t(`rule.type.${rule.type}`)}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-faint">{summarizeRule(rule)}</span>
        {hasError ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" /> : null}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleCollapse(rule.id);
            }}
            className="tip rounded p-0.5 text-faint hover:text-ink"
            data-tip={collapsed ? t('rule.expand') : t('rule.collapse')}
          >
            <ChevronDown size={11} className={cn('transition-transform', collapsed && '-rotate-90')} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              moveRule(rule.id, -1);
            }}
            className="rounded p-0.5 text-faint hover:text-ink"
            aria-label={t('rule.moveUp')}
          >
            <ArrowUp size={11} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              moveRule(rule.id, 1);
            }}
            className="rounded p-0.5 text-faint hover:text-ink"
            aria-label={t('rule.moveDown')}
          >
            <ArrowDown size={11} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              duplicateRule(rule.id);
            }}
            className="rounded p-0.5 text-faint hover:text-ink"
            aria-label={t('rule.duplicate')}
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              const store = useStore.getState();
              store.saveRulesAsTemplate([rule.id], `${t(`rule.type.${rule.type}`)} · ${new Date().toLocaleDateString()}`);
              store.pushToast('success', t('toast.templateSaved'));
            }}
            className="rounded p-0.5 text-faint hover:text-ink"
            aria-label={t('rule.saveTemplate')}
          >
            <LayoutTemplate size={11} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              removeRule(rule.id);
            }}
            className="rounded p-0.5 text-faint hover:text-danger"
            aria-label={t('rule.delete')}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="space-y-2 px-2 pb-2" onClick={(event) => event.stopPropagation()}>
          {rule.type === 'every' ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-12 shrink-0 text-[9px] text-faint">{t('field.interval')}</span>
                <input
                  type="number"
                  min={1}
                  value={rule.interval ?? ''}
                  onChange={(event) =>
                    patch({ interval: event.target.value === '' ? null : Math.max(1, Number(event.target.value)) })
                  }
                  className={cn(
                    'h-6 w-14 rounded-md border bg-raised px-1.5 text-[10px] text-ink outline-none focus:border-accent/50',
                    rule.interval ? 'border-line' : 'border-danger/50',
                  )}
                />
                <select
                  value={rule.unit}
                  onChange={(event) => patch({ unit: event.target.value as 'ticks' | 'seconds' })}
                  className="h-6 rounded-md border border-line bg-raised px-1.5 text-[10px] text-ink outline-none focus:border-accent/50"
                >
                  <option value="ticks">{t('unit.ticks')}</option>
                  <option value="seconds">{t('unit.seconds')}</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={rule.offset ?? ''}
                  onChange={(event) =>
                    patch({ offset: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })
                  }
                  placeholder={t('field.offset')}
                  className="h-6 w-16 rounded-md border border-line bg-raised px-1.5 text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
                />
                <label className="flex items-center gap-1 text-[9px] text-faint">
                  <input
                    type="checkbox"
                    checked={rule.global}
                    onChange={(event) => patch({ global: event.target.checked })}
                    className="h-3 w-3 accent-[rgb(var(--c-accent))]"
                  />
                  {t('field.global')}
                </label>
              </div>
              <BodyBlock list={rule.body} parentId={rule.id} bodyKey="body" title={t('rule.type.every')} depth={depth} />
            </>
          ) : null}

          {rule.type === 'pulse' ? (
            <BodyBlock list={rule.body} parentId={rule.id} bodyKey="body" title={t('rule.type.pulse')} depth={depth} />
          ) : null}

          {rule.type === 'input' || rule.type === 'output' ? (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-12 shrink-0 text-[9px] text-faint">{t('field.labels')}</span>
                  <div className="min-w-0 flex-1">
                    <LabelsInput value={rule.labels} onChange={(labels) => patch({ labels })} tags={tags} />
                  </div>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="mt-0.5 w-12 shrink-0 text-[9px] text-faint">{t('field.sides')}</span>
                  <div className="min-w-0 flex-1">
                    <SidesEditor value={rule.sides} onChange={(sides) => patch({ sides })} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-12 shrink-0 text-[9px] text-faint">{t('field.slots')}</span>
                  <input
                    value={rule.slots}
                    onChange={(event) => patch({ slots: event.target.value })}
                    placeholder="0-5, 8"
                    className="h-6 min-w-0 flex-1 rounded-md border border-line bg-raised px-1.5 font-mono text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
                  />
                  <label className="flex items-center gap-1 text-[9px] text-faint">
                    <input
                      type="checkbox"
                      checked={rule.each}
                      onChange={(event) => patch({ each: event.target.checked })}
                      className="h-3 w-3 accent-[rgb(var(--c-accent))]"
                    />
                    {t('field.each')}
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-12 shrink-0 text-[9px] text-faint">{t('field.roundRobin')}</span>
                  <select
                    value={rule.roundRobin ?? ''}
                    onChange={(event) =>
                      patch({ roundRobin: (event.target.value || null) as 'label' | 'block' | null })
                    }
                    className="h-6 rounded-md border border-line bg-raised px-1.5 text-[10px] text-ink outline-none focus:border-accent/50"
                  >
                    <option value="">{t('field.roundRobinNone')}</option>
                    <option value="label">{t('field.roundRobinLabel')}</option>
                    <option value="block">{t('field.roundRobinBlock')}</option>
                  </select>
                  {rule.type === 'output' ? (
                    <label className="flex items-center gap-1 text-[9px] text-faint">
                      <input
                        type="checkbox"
                        checked={rule.emptySlotsIn}
                        onChange={(event) => patch({ emptySlotsIn: event.target.checked })}
                        className="h-3 w-3 accent-[rgb(var(--c-accent))]"
                      />
                      {t('field.emptySlotsIn')}
                    </label>
                  ) : null}
                </div>
              </div>
              <IoOpsEditor value={rule.ops} onChange={(ops) => patch({ ops })} items={items} />
              <div className="flex items-center gap-1.5">
                <span className="w-12 shrink-0 text-[9px] text-faint">{t('field.except')}</span>
                <input
                  value={rule.except.join(', ')}
                  onChange={(event) =>
                    patch({
                      except: event.target.value
                        .split(/[,，]/)
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="minecraft:..."
                  className="h-6 min-w-0 flex-1 rounded-md border border-line bg-raised px-1.5 font-mono text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
                />
              </div>
            </>
          ) : null}

          {rule.type === 'if' && ifRule ? (
            <>
              <div className="flex items-start gap-1.5">
                <span className="mt-1 w-12 shrink-0 text-[9px] text-faint">{t('field.expr')}</span>
                <div className="min-w-0 flex-1">
                  <ExprInput value={ifRule.condition} onChange={(condition) => patch({ condition })} />
                </div>
              </div>
              <BodyBlock list={ifRule.then} parentId={ifRule.id} bodyKey="then" title={t('field.then')} depth={depth} />
              {ifRule.elifs.map((clause) => (
                <div key={clause.id} className="space-y-1 rounded-md border border-violet-400/20 bg-violet-400/5 p-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-semibold uppercase tracking-widest text-violet-300/80">
                      else if
                    </span>
                    <button
                      type="button"
                      onClick={() => removeElif(clause.id)}
                      className="rounded p-0.5 text-faint hover:text-danger"
                      aria-label={t('rule.delete')}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <ExprInput value={clause.condition} onChange={(condition) => updateElif(clause.id, condition)} />
                  <BodyBlock
                    list={clause.body}
                    parentId={clause.id}
                    bodyKey="elif"
                    title={t('field.then')}
                    depth={depth}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addElif}
                className="w-full rounded border border-dashed border-line py-1 text-[9px] text-faint transition-colors hover:border-violet-400/40 hover:text-violet-300"
              >
                + else if
              </button>
              <BodyBlock list={ifRule.else} parentId={ifRule.id} bodyKey="else" title={t('field.else')} depth={depth} />
            </>
          ) : null}

          {rule.type === 'forget' ? (
            <div className="flex items-center gap-1.5">
              <span className="w-12 shrink-0 text-[9px] text-faint">{t('field.labels')}</span>
              <div className="min-w-0 flex-1">
                <LabelsInput value={rule.labels} onChange={(labels) => patch({ labels })} tags={tags} />
              </div>
            </div>
          ) : null}

          <input
            value={rule.note}
            onChange={(event) => patch({ note: event.target.value })}
            placeholder={t('rule.notePlaceholder')}
            className="h-6 w-full rounded-md border border-transparent bg-transparent px-1.5 text-[9px] text-muted outline-none transition-colors placeholder:text-faint hover:border-line focus:border-accent/40"
          />
        </div>
      ) : null}

      <div className="hidden" data-parent={parentId} data-body={bodyKey} />
      <span className="hidden" data-rule-type={rule.type} />
    </div>
  );
}

function BodyBlock({
  list,
  parentId,
  bodyKey,
  title,
  depth,
}: {
  list: Rule[];
  parentId: string;
  bodyKey: BodyKey;
  title: string;
  depth: number;
}) {
  const t = useT();
  const { addRule } = useStore.getState();

  return (
    <div className="rounded-md border border-line/50 bg-app/40 pt-1">
      <div className="flex items-center justify-between px-1.5 pb-1">
        <span className="text-[8px] font-semibold uppercase tracking-widest text-faint">{title}</span>
        <AddRuleMenu onAdd={(type) => addRule(type, parentId, bodyKey)} label={t('rule.add')} />
      </div>
      <div className="px-1 pb-1">
        {list.length > 0 ? (
          <RuleList rules={list} depth={depth + 1} parentId={parentId} bodyKey={bodyKey} />
        ) : (
          <p className="px-1 py-1 text-[9px] text-faint/70">—</p>
        )}
      </div>
    </div>
  );
}
