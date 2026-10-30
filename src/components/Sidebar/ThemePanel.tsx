import { Check, Languages, Moon, Sun, Zap } from 'lucide-react';
import { ACCENTS, THEME_MODES } from '../../core/data/themes';
import { useStore } from '../../core/store/store';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={cn(
        'relative h-4 w-8 shrink-0 rounded-full border transition-colors',
        checked ? 'border-accent/60 bg-accent/30' : 'border-line bg-raised',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-2.5 w-2.5 rounded-full transition-transform',
          checked ? 'translate-x-[18px] bg-accent' : 'translate-x-0.5 bg-faint',
        )}
      />
    </button>
  );
}

export function ThemePanel() {
  const t = useT();
  const theme = useStore((state) => state.theme);
  const settings = useStore((state) => state.settings);
  const locale = settings.locale;
  const { setTheme, updateSettings, setLocale } = useStore.getState();

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-3">
      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-faint">{t('theme.title')}</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {THEME_MODES.map((mode) => {
            const Icon = mode.id === 'light' ? Sun : mode.id === 'cyber' ? Zap : Moon;
            const active = theme.mode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTheme({ mode: mode.id })}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border py-2 text-[9px] transition-colors',
                  active
                    ? 'border-accent/60 bg-accent/10 text-accent'
                    : 'border-line bg-raised/40 text-muted hover:border-accent/30 hover:text-ink',
                )}
              >
                <Icon size={14} />
                {locale === 'zh' ? mode.zh : mode.en}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-faint">{t('theme.accent')}</h3>
        <div className="flex flex-wrap gap-1.5">
          {ACCENTS.map((accent) => (
            <button
              key={accent.id}
              type="button"
              onClick={() => setTheme({ accent: accent.color, customAccent: accent.color })}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border transition-transform hover:scale-110',
                theme.accent.toLowerCase() === accent.color.toLowerCase()
                  ? 'border-ink/80 ring-2 ring-accent/30'
                  : 'border-transparent',
              )}
              style={{ background: accent.color }}
              title={accent.label}
            >
              {theme.accent.toLowerCase() === accent.color.toLowerCase() ? (
                <Check size={10} className="text-black/70" />
              ) : null}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={theme.customAccent || theme.accent}
            onChange={(event) => setTheme({ customAccent: event.target.value, accent: event.target.value })}
            className="h-6 w-8 cursor-pointer rounded border border-line bg-transparent"
          />
          <span className="font-mono text-[10px] text-faint">{theme.accent}</span>
        </div>
        <p className="mt-1 text-[9px] text-faint">{t('theme.accentHint')}</p>
      </section>

      <section className="mt-4 space-y-2 border-t border-line/60 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted">{t('theme.sound')}</span>
          <Toggle checked={settings.sound} onChange={(value) => updateSettings({ sound: value })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted">{t('theme.minimap')}</span>
          <Toggle checked={settings.showMinimap} onChange={(value) => updateSettings({ showMinimap: value })} />
        </div>
      </section>

      <section className="mt-4 border-t border-line/60 pt-3">
        <h3 className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-faint">
          <Languages size={10} />
          {t('theme.language')}
        </h3>
        <div className="flex gap-1.5">
          {(['zh', 'en'] as const).map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => setLocale(locale)}
              className={cn(
                'flex-1 rounded-md border py-1.5 text-[10px] transition-colors',
                settings.locale === locale
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : 'border-line bg-raised/40 text-muted hover:text-ink',
              )}
            >
              {locale === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-auto border-t border-line/60 pt-3">
        <p className="text-[9px] leading-relaxed text-faint">
          {t('settings.version')} 1.0.0 · {t('settings.storage')}
          <br />
          {t('settings.storageHint')}
        </p>
      </section>
    </div>
  );
}
