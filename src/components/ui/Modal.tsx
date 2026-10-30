import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Modal({ open, onClose, title, subtitle, icon, children, footer, className, bodyClassName }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      />
      <div
        className={cn(
          'relative z-10 flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-surface card-shadow animate-slide-up',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          {icon ? <div className="mt-0.5 text-accent">{icon}</div> : null}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold tracking-wide text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tip rounded-md p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
            data-tip="Esc"
            aria-label="close"
          >
            <X size={15} />
          </button>
        </header>
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
        {footer ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-raised/40 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
