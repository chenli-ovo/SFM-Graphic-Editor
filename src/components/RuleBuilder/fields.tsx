import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { exprToText } from '../../core/parser/serialize';
import { parseExprText } from '../../core/parser/parse';
import { emptyOp } from '../../core/rules/tree';
import { useStore } from '../../core/store/store';
import type { BoolExpr, IoOp, Item, Side, SideSpec, Tag } from '../../core/types';
import { SIDES } from '../../core/types';
import { readDragPayload } from '../../lib/dnd';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';

const inputClass =
  'h-6 min-w-0 rounded-md border border-line bg-raised px-1.5 text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50';

/** 标签列表输入：逗号分隔，支持从侧栏拖入标签 */
export function LabelsInput({
  value,
  onChange,
  tags,
  placeholder,
}: {
  value: string[];
  onChange: (labels: string[]) => void;
  tags: Tag[];
  placeholder?: string;
}) {
  const t = useT();
  const joined = value.join(', ');
  const [text, setText] = useState(joined);
  const [over, setOver] = useState(false);

  useEffect(() => {
    setText(joined);
  }, [joined]);

  const commit = (next: string) => {
    setText(next);
    onChange(
      next
        .split(/[,，]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
  };

  const handleDrop = (event: DragEvent<HTMLInputElement>) => {
    event.preventDefault();
    setOver(false);
    const payload = readDragPayload(event);
    if (!payload) return;
    const next = payload.kind === 'tag' ? payload.value : payload.value;
    if (!value.includes(next)) onChange([...value, next]);
  };

  return (
    <input
      value={text}
      onChange={(event) => commit(event.target.value)}
      onBlur={() => commit(text)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      list="sfm-tags"
      placeholder={placeholder ?? t('field.labelsHint')}
      className={cn(inputClass, 'w-full', over && 'drop-target border-accent/70')}
    />
  );
}

/** 朝向编辑器：多选 chips + each 切换 */
export function SidesEditor({ value, onChange }: { value: SideSpec; onChange: (next: SideSpec) => void }) {
  const t = useT();
  const toggle = (side: Side) => {
    if (value.mode === 'each') {
      onChange({ mode: 'list', sides: [side] });
      return;
    }
    const exists = value.sides.includes(side);
    const sides = exists ? value.sides.filter((entry) => entry !== side) : [...value.sides, side];
    onChange({ mode: sides.length ? 'list' : 'none', sides });
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {SIDES.map((side) => {
        const active = value.mode === 'list' && value.sides.includes(side);
        return (
          <button
            key={side}
            type="button"
            onClick={() => toggle(side)}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[9px] uppercase transition-colors',
              active
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-line bg-raised text-muted hover:text-ink',
            )}
          >
            {side}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange(value.mode === 'each' ? { mode: 'none', sides: [] } : { mode: 'each', sides: [] })}
        className={cn(
          'rounded border px-1.5 py-0.5 text-[9px] uppercase transition-colors',
          value.mode === 'each' ? 'border-accent/50 bg-accent/15 text-accent' : 'border-line bg-raised text-muted hover:text-ink',
        )}
      >
        {t('field.each')}
      </button>
      {value.mode !== 'none' ? (
        <button
          type="button"
          onClick={() => onChange({ mode: 'none', sides: [] })}
          className="rounded px-1 py-0.5 text-[9px] text-faint hover:text-ink"
        >
          {t('field.sideNone')}
        </button>
      ) : null}
    </div>
  );
}

/** input/output 的操作项列表（数量 / retain / resource / with / without） */
export function IoOpsEditor({
  value,
  onChange,
  items,
}: {
  value: IoOp[];
  onChange: (ops: IoOp[]) => void;
  items: Item[];
}) {
  const t = useT();
  const update = (index: number, patch: Partial<IoOp>) => {
    onChange(value.map((op, i) => (i === index ? { ...op, ...patch } : op)));
  };
  const numberValue = (input: string): number | null => {
    if (input === '') return null;
    const parsed = Number(input);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
  };

  return (
    <div className="space-y-1 rounded-md border border-line/50 bg-app/30 p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-semibold uppercase tracking-widest text-faint">{t('field.ops')}</span>
        <button
          type="button"
          onClick={() => onChange([...value, emptyOp()])}
          className="flex items-center gap-0.5 rounded border border-line bg-raised px-1 py-0.5 text-[9px] text-muted hover:text-accent"
        >
          <Plus size={9} /> {t('rule.addOp')}
        </button>
      </div>
      {value.map((op, index) => (
        <div key={index} className="grid grid-cols-12 items-center gap-1">
          <input
            type="number"
            min={0}
            value={op.count ?? ''}
            onChange={(event) => update(index, { count: numberValue(event.target.value) })}
            placeholder={t('field.opCount')}
            className={cn(inputClass, 'col-span-1')}
          />
          <label className="col-span-1 flex items-center justify-center gap-0.5 text-[8px] text-faint">
            <input
              type="checkbox"
              checked={op.countEach}
              onChange={(event) => update(index, { countEach: event.target.checked })}
              className="h-2.5 w-2.5 accent-[rgb(var(--c-accent))]"
            />
            each
          </label>
          <input
            type="number"
            min={0}
            value={op.retain ?? ''}
            onChange={(event) => update(index, { retain: numberValue(event.target.value) })}
            placeholder={t('field.opRetain')}
            className={cn(inputClass, 'col-span-1')}
          />
          <label className="col-span-1 flex items-center justify-center gap-0.5 text-[8px] text-faint">
            <input
              type="checkbox"
              checked={op.retainEach}
              onChange={(event) => update(index, { retainEach: event.target.checked })}
              className="h-2.5 w-2.5 accent-[rgb(var(--c-accent))]"
            />
            each
          </label>
          <input
            value={op.resource}
            onChange={(event) => update(index, { resource: event.target.value })}
            list="sfm-items"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(event) => {
              event.preventDefault();
              const payload = readDragPayload(event);
              if (payload?.kind === 'item') update(index, { resource: payload.value });
            }}
            placeholder={t('field.resourceHint')}
            className={cn(inputClass, 'col-span-3 font-mono')}
          />
          <input
            value={op.withClause ?? ''}
            onChange={(event) => update(index, { withClause: event.target.value || null })}
            placeholder="with"
            className={cn(inputClass, 'col-span-2 font-mono')}
          />
          <input
            value={op.withoutClause ?? ''}
            onChange={(event) => update(index, { withoutClause: event.target.value || null })}
            placeholder="without"
            className={cn(inputClass, 'col-span-2 font-mono')}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            className="col-span-1 rounded p-0.5 text-faint hover:text-danger"
            aria-label="remove"
          >
            <Trash2 size={10} />
          </button>
        </div>
      ))}
      {value.length === 0 ? (
        <p className="text-[9px] text-faint/70">{t('field.ops')}: —</p>
      ) : null}
    </div>
  );
}

/** 条件表达式：直接编辑完整 boolexpr 文本，失焦解析 */
export function ExprInput({ value, onChange }: { value: BoolExpr; onChange: (expr: BoolExpr) => void }) {
  const t = useT();
  const serialized = exprToText(value);
  const [text, setText] = useState(serialized);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(serialized);
    setInvalid(false);
  }, [serialized]);

  const commit = () => {
    if (text.trim() === serialized) {
      setInvalid(false);
      return;
    }
    const parsed = parseExprText(text);
    if (!parsed) {
      setInvalid(true);
      useStore.getState().pushToast('error', t('toast.exprParseFailed'));
      return;
    }
    setInvalid(false);
    onChange(parsed);
  };

  return (
    <div className="space-y-1">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            commit();
          }
        }}
        rows={2}
        spellCheck={false}
        placeholder={t('field.exprHint')}
        className={cn(
          'w-full resize-y rounded-md border bg-raised px-1.5 py-1 font-mono text-[10px] text-ink outline-none focus:border-accent/50',
          invalid ? 'border-danger/60' : 'border-line',
        )}
      />
      <p className="text-[8px] text-faint/80">{t('field.exprHint')}</p>
    </div>
  );
}
