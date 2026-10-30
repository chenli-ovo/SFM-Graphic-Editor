import { Download, FileDown, FileUp, LayoutTemplate, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useStore } from '../../core/store/store';
import { downloadText, safeFileName } from '../../lib/utils';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';

export function TemplatePanel() {
  const t = useT();
  const templates = useStore((state) => state.templates);
  const selectedRuleId = useStore((state) => state.selectedRuleId);
  const ruleCount = useStore((state) =>
    state.projects.find((project) => project.id === state.activeProjectId)?.rules.length ?? 0,
  );
  const { saveRulesAsTemplate, insertTemplate, deleteTemplate, importTemplateText, pushToast } = useStore.getState();

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    if (!selectedRuleId) {
      pushToast('warning', t('template.saveHint'));
      return;
    }
    const title = name.trim() || `${t('template.name')} ${ruleCount}`;
    if (!saveRulesAsTemplate([selectedRuleId], title)) {
      pushToast('error', t('toast.error'));
      return;
    }
    pushToast('success', t('toast.templateSaved'));
    setName('');
    setCreating(false);
  };

  const exportTemplate = (id: string) => {
    const template = templates.find((entry) => entry.id === id);
    if (!template) return;
    downloadText(JSON.stringify(template, null, 2), `${safeFileName(template.name)}.template.json`, 'application/json');
    pushToast('success', t('toast.exported'));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-line/60 px-3 py-2">
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="tip flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-2 text-[10px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-accent"
          data-tip={t('template.save')}
        >
          <LayoutTemplate size={12} />
          {t('template.save')}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="tip flex h-7 w-7 items-center justify-center rounded-md border border-line bg-raised text-muted transition-colors hover:border-accent/40 hover:text-accent"
          data-tip={t('template.import')}
        >
          <FileUp size={12} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const text = await file.text();
            if (importTemplateText(text)) pushToast('success', t('toast.imported'));
            else pushToast('error', t('toast.error'));
          }}
        />
      </div>

      {creating ? (
        <div className="space-y-1.5 border-b border-line/60 bg-raised/40 px-3 py-2.5">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
              if (event.key === 'Escape') setCreating(false);
            }}
            placeholder={t('template.name')}
            className="h-7 w-full rounded-md border border-line bg-surface px-2 text-[11px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
          />
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-faint">{selectedRuleId ? t('template.saveHint') : t('toast.noSelection')}</span>
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-accent/15 px-2.5 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {templates.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-faint">{t('template.empty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {templates.map((template) => (
              <li
                key={template.id}
                className="group rounded-md border border-line bg-surface/60 px-2.5 py-2 transition-colors hover:border-accent/40"
              >
                <div className="flex items-start gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-medium text-ink">{template.name}</span>
                      {template.builtin ? (
                        <span className="shrink-0 rounded border border-accent/30 bg-accent/10 px-1 text-[8px] text-accent">
                          {t('template.builtin')}
                        </span>
                      ) : null}
                    </div>
                    {template.description ? (
                      <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-faint">{template.description}</p>
                    ) : null}
                    <p className="mt-1 text-[8px] text-faint">
                      {t('toolbar.rules', { count: template.rules.length })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => exportTemplate(template.id)}
                      className="tip rounded p-0.5 text-faint transition-colors hover:text-ink"
                      data-tip={t('template.export')}
                    >
                      <FileDown size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteTemplate(template.id);
                        pushToast('info', t('common.delete'));
                      }}
                      className="rounded p-0.5 text-faint transition-colors hover:text-danger"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      insertTemplate(template.id, null);
                      pushToast('success', t('common.insert'));
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-line bg-raised py-1 text-[9px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    <Download size={9} />
                    {t('template.insertTop')}
                  </button>
                  {selectedRuleId ? (
                    <button
                      type="button"
                      onClick={() => {
                        insertTemplate(template.id, selectedRuleId);
                        pushToast('success', t('common.insert'));
                      }}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1 rounded border border-line bg-raised py-1 text-[9px] text-muted transition-colors hover:border-accent/40 hover:text-accent',
                      )}
                    >
                      {t('template.insert')}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="shrink-0 border-t border-line/60 px-3 py-2 text-[9px] text-faint">{t('template.saveHint')}</p>
    </div>
  );
}
