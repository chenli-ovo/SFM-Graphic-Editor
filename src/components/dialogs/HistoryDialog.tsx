import { History, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { countRules } from '../../core/rules/tree';
import { useStore } from '../../core/store/store';
import { useT } from '../../lib/useT';
import { formatTime } from '../../lib/utils';
import { Modal } from '../ui/Modal';

export function HistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const project = useStore((state) => state.projects.find((entry) => entry.id === state.activeProjectId));
  const { saveSnapshot, restoreSnapshot, deleteSnapshot, pushToast } = useStore.getState();
  const [name, setName] = useState('');
  const snapshots = project?.snapshots ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('history.title')}
      subtitle={t('history.snapshots')}
      icon={<History size={13} />}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] text-faint">{project?.name}</span>
          <div className="flex items-center gap-1.5">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('history.namePlaceholder')}
              className="h-7 w-40 rounded-md border border-line bg-raised px-2 text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => {
                saveSnapshot(name.trim() || undefined);
                setName('');
                pushToast('success', t('toast.saved'));
              }}
              className="flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] text-accent transition-colors hover:bg-accent/20"
            >
              <Save size={10} />
              {t('history.save')}
            </button>
          </div>
        </div>
      }
    >
      {snapshots.length === 0 ? (
        <p className="py-8 text-center text-[10px] text-faint">{t('history.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {snapshots.map((snapshot) => (
            <li
              key={snapshot.id}
              className="flex items-center gap-2 rounded-md border border-line bg-raised/40 px-2.5 py-1.5 transition-colors hover:border-line/80"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] text-ink">{snapshot.name}</p>
                <p className="text-[9px] text-faint">
                  {formatTime(snapshot.timestamp)} · {countRules(snapshot.rules)} rules
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  restoreSnapshot(snapshot.id);
                  pushToast('success', t('toast.snapshotRestored'));
                  onClose();
                }}
                className="rounded border border-line p-1 text-faint transition-colors hover:text-accent"
                title={t('history.restore')}
              >
                <RotateCcw size={10} />
              </button>
              <button
                type="button"
                onClick={() => deleteSnapshot(snapshot.id)}
                className="rounded border border-line p-1 text-faint transition-colors hover:text-danger"
                title={t('history.delete')}
              >
                <Trash2 size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
