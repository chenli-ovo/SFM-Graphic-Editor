import { Database, FileJson, HardDriveDownload, Languages, Palette, Settings2, Sparkles, Volume2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { THEME_MODES, ACCENTS } from '../../core/data/themes';
import { clearWorkspace } from '../../core/store/persistence';
import { useStore } from '../../core/store/store';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const settings = useStore((state) => state.settings);
  const theme = useStore((state) => state.theme);
  const { updateSettings, updateAi, setLocale, setTheme, exportBackup, exportProjectJson, importBackup, importProjectText, pushToast } =
    useStore.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importKind, setImportKind] = useState<'backup' | 'project'>('backup');

  const pickFile = (kind: 'backup' | 'project') => {
    setImportKind(kind);
    window.setTimeout(() => fileRef.current?.click(), 0);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const ok = importKind === 'backup' ? importBackup(text) : importProjectText(text);
      if (ok) {
        pushToast('success', t('toast.imported'));
        onClose();
      } else {
        pushToast('error', t('toast.error'));
      }
    } catch {
      pushToast('error', t('toast.error'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('settings.title')}
      icon={<Settings2 size={13} />}
      footer={
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-faint">
            {t('settings.version')} 1.0.0 · {t('settings.storage')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-1 text-[10px] text-muted transition-colors hover:text-ink"
          >
            <X size={10} className="mr-1 inline" />
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="space-y-1.5">
          <Label icon={Languages}>{t('settings.language')}</Label>
          <div className="flex gap-1.5">
            {(['zh', 'en'] as const).map((locale) => (
              <button
                key={locale}
                type="button"
                onClick={() => setLocale(locale)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[10px] transition-colors',
                  settings.locale === locale
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-line text-muted hover:text-ink',
                )}
              >
                {locale === 'zh' ? '中文' : 'English'}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-1.5">
          <Label icon={Palette}>{t('sidebar.theme')}</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {THEME_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTheme({ mode: mode.id })}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-[10px] transition-colors',
                  theme.mode === mode.id
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-line text-muted hover:text-ink',
                )}
              >
                {mode.icon} {settings.locale === 'zh' ? mode.zh : mode.en}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                type="button"
                title={settings.locale === 'zh' ? accent.label : accent.labelEn}
                onClick={() => setTheme({ accent: accent.id })}
                className={cn(
                  'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                  theme.accent === accent.id ? 'border-ink' : 'border-transparent',
                )}
                style={{ background: accent.color }}
              />
            ))}
            <input
              type="color"
              value={theme.customAccent}
              onChange={(event) => setTheme({ customAccent: event.target.value, accent: 'custom' })}
              className="h-5 w-5 cursor-pointer rounded border border-line bg-transparent p-0"
              title={t('theme.customAccent')}
            />
          </div>
        </section>

        <section className="space-y-1.5">
          <Label icon={Volume2}>{t('settings.editor')}</Label>
          <div className="flex gap-1.5">
            <Toggle
              checked={settings.sound}
              onChange={(value) => updateSettings({ sound: value })}
              label={t('settings.sound')}
            />
            <Toggle
              checked={settings.showMinimap}
              onChange={(value) => updateSettings({ showMinimap: value })}
              label={t('settings.minimap')}
            />
          </div>
        </section>

        <section className="space-y-1.5">
          <Label icon={Sparkles}>{t('settings.ai')}</Label>
          <div className="space-y-1.5">
            <input
              value={settings.ai.baseUrl}
              onChange={(event) => updateAi({ baseUrl: event.target.value })}
              placeholder={t('ai.baseUrl')}
              className="h-7 w-full rounded-md border border-line bg-raised px-2 font-mono text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <input
              value={settings.ai.model}
              onChange={(event) => updateAi({ model: event.target.value })}
              placeholder={t('ai.model')}
              className="h-7 w-full rounded-md border border-line bg-raised px-2 font-mono text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <input
              value={settings.ai.apiKey}
              onChange={(event) => updateAi({ apiKey: event.target.value })}
              placeholder={t('ai.apiKey')}
              type="password"
              className="h-7 w-full rounded-md border border-line bg-raised px-2 font-mono text-[10px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <p className="text-[9px] text-faint">{t('settings.storageHint')}</p>
          </div>
        </section>

        <section className="space-y-1.5">
          <Label icon={Database}>{t('settings.data')}</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <DataButton icon={HardDriveDownload} onClick={exportBackup} label={t('settings.backup')} />
            <DataButton icon={FileJson} onClick={exportProjectJson} label={t('settings.exportProject')} />
            <DataButton icon={HardDriveDownload} onClick={() => pickFile('backup')} label={t('settings.restore')} />
            <DataButton icon={FileJson} onClick={() => pickFile('project')} label={t('settings.importProject')} />
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm(t('settings.resetConfirm'))) return;
              await clearWorkspace();
              pushToast('info', t('settings.resetDone'));
              window.setTimeout(() => window.location.reload(), 400);
            }}
            className="mt-1 w-full rounded-md border border-danger/30 px-2 py-1 text-[9px] text-danger/80 transition-colors hover:bg-danger/10 hover:text-danger"
          >
            {t('settings.resetWorkspace')}
          </button>
          <p className="text-[9px] text-faint">{t('settings.importHint')}</p>
        </section>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.sfm"
        className="hidden"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </Modal>
  );
}

function Label({ icon: Icon, children }: { icon: typeof Settings2; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-faint">
      <Icon size={9} />
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[10px] text-muted transition-colors hover:text-ink"
    >
      <span className={cn('relative h-3 w-5 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
        <span
          className={cn(
            'absolute top-0 h-3 w-3 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-2' : 'translate-x-0',
          )}
        />
      </span>
      {label}
    </button>
  );
}

function DataButton({ icon: Icon, label, onClick }: { icon: typeof Settings2; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-left text-[10px] text-muted transition-colors hover:border-accent/40 hover:text-ink"
    >
      <Icon size={10} />
      {label}
    </button>
  );
}
