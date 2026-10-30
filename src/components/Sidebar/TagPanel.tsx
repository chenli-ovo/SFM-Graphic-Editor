import { Plus, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore, useActiveProject } from '../../core/store/store';
import type { Rule, Tag } from '../../core/types';
import { setDragPayload } from '../../lib/dnd';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';
import { ACCENTS } from '../../core/data/themes';

const ACCENT_COLORS = ACCENTS.map((accent) => accent.color);

function countTagUsage(rules: Rule[], tagName: string): number {
  let count = 0;
  const visitExpr = (expr: import('../../core/types').BoolExpr) => {
    if (expr.kind === 'has' && expr.labels.includes(tagName)) count += 1;
    if (expr.kind === 'not') visitExpr(expr.expr);
    if (expr.kind === 'and' || expr.kind === 'or') {
      visitExpr(expr.left);
      visitExpr(expr.right);
    }
  };
  const walk = (list: Rule[]) => {
    for (const rule of list) {
      if (rule.type === 'input' || rule.type === 'output' || rule.type === 'forget') {
        if (rule.labels.includes(tagName)) count += 1;
      }
      if (rule.type === 'if') {
        visitExpr(rule.condition);
        walk(rule.then);
        rule.elifs.forEach((clause) => {
          visitExpr(clause.condition);
          walk(clause.body);
        });
        walk(rule.else);
      }
      if (rule.type === 'every' || rule.type === 'pulse') walk(rule.body);
    }
  };
  walk(rules);
  return count;
}

export function TagPanel() {
  const t = useT();
  const project = useActiveProject();
  const tags = project?.tags ?? [];
  const rules = project?.rules ?? [];
  const { addTag, removeTag, updateTag, pushToast } = useStore.getState();

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(ACCENT_COLORS[0]);

  const filtered = useMemo(
    () =>
      tags.filter((tag) =>
        !query.trim() ? true : `${tag.name} ${tag.note}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [tags, query],
  );

  const submit = () => {
    const value = name.trim();
    if (!value) return;
    const ok = addTag(value, color);
    if (!ok) {
      pushToast('warning', t('tag.nameRule'));
      return;
    }
    setName('');
    setCreating(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('common.search')}
          className="h-7 min-w-0 flex-1 rounded-md border border-line bg-raised px-2 text-[11px] text-ink outline-none transition-colors placeholder:text-faint focus:border-accent/50"
        />
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="tip flex h-7 w-7 items-center justify-center rounded-md border border-line bg-raised text-muted transition-colors hover:border-accent/40 hover:text-accent"
          data-tip={t('tag.new')}
        >
          <Plus size={13} />
        </button>
      </div>

      {creating ? (
        <div className="border-b border-line/60 bg-raised/40 px-3 py-2.5">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
              if (event.key === 'Escape') setCreating(false);
            }}
            placeholder={t('tag.namePlaceholder')}
            className="h-7 w-full rounded-md border border-line bg-surface px-2 text-[11px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
          />
          <div className="mt-2 flex items-center gap-1.5">
            {ACCENT_COLORS.slice(0, 6).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setColor(preset)}
                className={cn(
                  'h-4 w-4 rounded-full border transition-transform hover:scale-110',
                  color === preset ? 'border-ink/70 ring-2 ring-accent/30' : 'border-transparent',
                )}
                style={{ background: preset }}
                aria-label={preset}
              />
            ))}
            <div className="flex-1" />
            <button
              type="button"
              onClick={submit}
              className="rounded-md bg-accent/15 px-2.5 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25"
            >
              {t('common.add')}
            </button>
          </div>
          <p className="mt-1.5 text-[9px] text-faint">{t('tag.nameRule')}</p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-faint">{t('tag.empty')}</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                usage={countTagUsage(rules, tag.name)}
                onRemove={() => {
                  if (window.confirm(t('tag.deleteConfirm', { name: tag.name }))) removeTag(tag.id);
                }}
                onColor={(value) => updateTag(tag.id, { color: value })}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="shrink-0 border-t border-line/60 px-3 py-2 text-[9px] text-faint">{t('tag.dragHint')}</p>
    </div>
  );
}

function TagRow({
  tag,
  usage,
  onRemove,
  onColor,
}: {
  tag: Tag;
  usage: number;
  onRemove: () => void;
  onColor: (color: string) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);

  return (
    <li
      draggable
      onDragStart={(event) => setDragPayload(event, { kind: 'tag', value: tag.name })}
      className="group flex cursor-grab select-none items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-line hover:bg-raised/70 active:cursor-grabbing"
      title={t('tag.dragHint')}
    >
      <button
        type="button"
        onClick={() => setEditing((value) => !value)}
        className="relative h-4 w-4 shrink-0 rounded-full border border-black/20"
        style={{ background: tag.color }}
        aria-label={t('tag.color')}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-ink">{tag.name}</div>
        <div className="truncate text-[9px] text-faint">{t('tag.usage', { count: usage })}</div>
      </div>
      {editing ? (
        <input
          type="color"
          value={tag.color}
          onChange={(event) => onColor(event.target.value)}
          className="h-5 w-6 cursor-pointer rounded border border-line bg-transparent"
        />
      ) : (
        <TagIcon size={11} className="shrink-0 text-faint" />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
        aria-label={t('common.delete')}
      >
        <Trash2 size={11} />
      </button>
    </li>
  );
}
