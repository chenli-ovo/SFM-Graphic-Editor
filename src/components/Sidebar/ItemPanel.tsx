import { Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CATEGORIES, shortItemId } from '../../core/data/items';
import { useStore, useActiveProject } from '../../core/store/store';
import type { ItemCategory } from '../../core/types';
import { setDragPayload } from '../../lib/dnd';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';

export function ItemPanel() {
  const t = useT();
  const locale = useStore((state) => state.settings.locale);
  const project = useActiveProject();
  const items = project?.items ?? [];
  const { addItem, removeItem, pushToast } = useStore.getState();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] = useState<ItemCategory>('misc');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!needle) return true;
      return `${item.id} ${item.name}`.toLowerCase().includes(needle);
    });
  }, [items, query, category]);

  const submit = () => {
    const id = draftId.trim();
    if (!id) return;
    if (!/^[a-z0-9_]+:[a-z0-9_]+$/.test(id)) {
      pushToast('warning', t('item.idPlaceholder'));
      return;
    }
    const ok = addItem({
      id,
      name: draftName.trim() || shortItemId(id),
      category: draftCategory,
      icon: '📦',
    });
    if (!ok) {
      pushToast('warning', t('item.id'));
      return;
    }
    setDraftId('');
    setDraftName('');
    setCreating(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={11} className="pointer-events-none absolute left-2 top-2 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('item.search')}
              className="h-7 w-full rounded-md border border-line bg-raised pl-6 pr-2 text-[11px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
          </div>
          <button
            type="button"
            onClick={() => setCreating((value) => !value)}
            className="tip flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-raised text-muted transition-colors hover:border-accent/40 hover:text-accent"
            data-tip={t('item.new')}
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[9px] transition-colors',
              category === 'all'
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-line text-faint hover:text-muted',
            )}
          >
            {locale === 'zh' ? '全部' : 'All'}
          </button>
          {CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setCategory(entry.id)}
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[9px] transition-colors',
                category === entry.id
                  ? 'border-accent/50 bg-accent/15 text-accent'
                  : 'border-line text-faint hover:text-muted',
              )}
            >
              {entry.icon} {locale === 'zh' ? entry.zh : entry.en}
            </button>
          ))}
        </div>
      </div>

      {creating ? (
        <div className="space-y-1.5 border-b border-line/60 bg-raised/40 px-3 py-2.5">
          <input
            autoFocus
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
              if (event.key === 'Escape') setCreating(false);
            }}
            placeholder={t('item.idPlaceholder')}
            className="h-7 w-full rounded-md border border-line bg-surface px-2 font-mono text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
          />
          <div className="flex gap-1.5">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder={t('item.displayName')}
              className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <select
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value as ItemCategory)}
              className="h-7 shrink-0 rounded-md border border-line bg-surface px-1 text-[10px] text-ink outline-none focus:border-accent/50"
            >
              {CATEGORIES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.icon} {locale === 'zh' ? entry.zh : entry.en}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={submit}
              className="shrink-0 rounded-md bg-accent/15 px-2 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25"
            >
              {t('common.add')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-faint">{t('item.empty')}</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((item) => (
              <li
                key={item.id}
                draggable
                onDragStart={(event) => setDragPayload(event, { kind: 'item', value: item.id })}
                className="group flex cursor-grab select-none items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-line hover:bg-raised/70 active:cursor-grabbing"
                title={t('item.dragHint')}
              >
                <span className="w-4 shrink-0 text-center text-[12px] leading-none">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-ink">{item.name}</div>
                  <div className="truncate font-mono text-[9px] text-faint">{item.id}</div>
                </div>
                <span className="shrink-0 rounded border border-line px-1 text-[8px] text-faint">
                  {item.custom ? t('item.custom') : shortItemId(item.id)}
                </span>
                {item.custom ? (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 size={11} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="shrink-0 border-t border-line/60 px-3 py-2 text-[9px] text-faint">{t('item.dragHint')}</p>
    </div>
  );
}
