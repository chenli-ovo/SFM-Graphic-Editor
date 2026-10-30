import { Share2 } from 'lucide-react';
import { useStore } from '../../core/store/store';
import type { SharePayload } from '../../lib/share';
import { formatTime } from '../../lib/utils';
import { useT } from '../../lib/useT';
import { Modal } from '../ui/Modal';

interface ShareImportDialogProps {
  payload: SharePayload | null;
  onClose: () => void;
}

function clearShareHash() {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

export function ShareImportDialog({ payload, onClose }: ShareImportDialogProps) {
  const t = useT();

  const dismiss = () => {
    clearShareHash();
    onClose();
  };

  const confirm = () => {
    if (!payload) return;
    useStore.getState().importSharedProject(payload);
    clearShareHash();
    onClose();
  };

  return (
    <Modal
      open={Boolean(payload)}
      onClose={dismiss}
      title={t('share.title')}
      subtitle={t('share.hint')}
      icon={<Share2 size={15} />}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md border border-line px-3 py-1.5 text-[11px] text-muted transition-colors hover:border-line hover:text-ink"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded-md bg-accent px-3 py-1.5 text-[11px] font-medium text-app transition-opacity hover:opacity-90"
          >
            {t('share.import')}
          </button>
        </div>
      }
    >
      {payload ? (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted">{t('share.name')}</span>
            <span className="font-medium text-ink">{payload.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">{t('share.rules')}</span>
            <span className="font-mono text-ink">{payload.rules.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">{t('share.tags')}</span>
            <span className="font-mono text-ink">{payload.tags.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">{t('share.time')}</span>
            <span className="text-ink">{formatTime(payload.createdAt)}</span>
          </div>
          <p className="rounded-md border border-line bg-app/60 p-2 text-[10px] leading-relaxed text-faint">
            {t('share.notice')}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
