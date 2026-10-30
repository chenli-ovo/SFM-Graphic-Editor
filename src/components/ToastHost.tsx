import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useStore } from '../core/store/store';
import { cn } from '../lib/utils';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const TONES = {
  info: 'border-info/40 text-info',
  success: 'border-ok/40 text-ok',
  warning: 'border-warn/40 text-warn',
  error: 'border-danger/40 text-danger',
} as const;

export function ToastHost() {
  const toasts = useStore((state) => state.toasts);
  const dismissToast = useStore((state) => state.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-12 right-5 z-[95] flex w-80 flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-overlay/95 px-3.5 py-2.5 shadow-lg backdrop-blur animate-slide-up',
              TONES[toast.kind],
            )}
          >
            <Icon size={15} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1 break-words text-xs leading-relaxed text-ink">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded p-0.5 text-muted transition-colors hover:text-ink"
              aria-label="dismiss"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
