import { Boxes, LayoutTemplate, Palette, PanelLeftClose, Tags } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStore, type SidebarTab } from '../../core/store/store';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';
import { ItemPanel } from './ItemPanel';
import { TagPanel } from './TagPanel';
import { TemplatePanel } from './TemplatePanel';
import { ThemePanel } from './ThemePanel';

const TABS: Array<{ id: SidebarTab; icon: LucideIcon; key: 'sidebar.tags' | 'sidebar.items' | 'sidebar.templates' | 'sidebar.theme' }> = [
  { id: 'tags', icon: Tags, key: 'sidebar.tags' },
  { id: 'items', icon: Boxes, key: 'sidebar.items' },
  { id: 'templates', icon: LayoutTemplate, key: 'sidebar.templates' },
  { id: 'theme', icon: Palette, key: 'sidebar.theme' },
];

export function Sidebar() {
  const t = useT();
  const collapsed = useStore((state) => state.sidebarCollapsed);
  const tab = useStore((state) => state.sidebarTab);
  const { setSidebarTab, toggleSidebar } = useStore.getState();

  return (
    <div
      className="relative shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ width: collapsed ? 0 : 292 }}
    >
      <aside
        className={cn(
          'flex h-full w-[292px] flex-col border-r border-line bg-surface transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform',
          collapsed && '-translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-center gap-0.5 border-b border-line px-2 py-1.5">
          {TABS.map((entry) => {
            const Icon = entry.icon;
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSidebarTab(entry.id)}
                data-tip={t(entry.key)}
                className={cn(
                  'tip flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[10px] transition-colors',
                  active ? 'bg-accent/12 text-accent' : 'text-muted hover:bg-raised hover:text-ink',
                )}
              >
                <Icon size={13} />
                <span className="hidden 2xl:inline">{t(entry.key)}</span>
              </button>
            );
          })}
          <div className="mx-1 h-4 w-px bg-line" />
          <button
            type="button"
            onClick={toggleSidebar}
            data-tip={t('sidebar.collapse')}
            className="tip-right tip flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-raised hover:text-ink"
          >
            <PanelLeftClose size={13} />
          </button>
        </div>

        <div className="min-h-0 flex-1">
          {tab === 'tags' ? <TagPanel /> : null}
          {tab === 'items' ? <ItemPanel /> : null}
          {tab === 'templates' ? <TemplatePanel /> : null}
          {tab === 'theme' ? <ThemePanel /> : null}
        </div>
      </aside>
    </div>
  );
}
