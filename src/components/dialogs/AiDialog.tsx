import { Loader2, Send, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../core/store/store';
import type { Tag } from '../../core/types';
import { useT } from '../../lib/useT';
import { cn } from '../../lib/utils';
import { generateRulesFromPrompt } from '../../lib/ai';
import type { AiResponse } from '../../lib/ai';
import { Modal } from '../ui/Modal';

const EMPTY_TAGS: Tag[] = [];

const EXAMPLES_ZH = [
  '每秒从箱子抽取 8 个铁矿石，输出到熔炉标签',
  '红石上升沿时把熔炉的输出送到存储标签',
  '当箱子里有铁矿时，输出到传送带方块',
];
const EXAMPLES_EN = [
  'Every second extract 8 iron ore from a chest and output to the furnace tag',
  'On rising redstone edge, output smelted items to the storage tag',
  'If the chest has iron ingot, output to the east belt block',
];

export function AiDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const settings = useStore((state) => state.settings);
  const locale = useStore((state) => state.settings.locale);
  const project = useStore((state) => state.projects.find((entry) => entry.id === state.activeProjectId));
  const tags = project?.tags ?? EMPTY_TAGS;
  const { applyAiRules, pushToast } = useStore.getState();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [error, setError] = useState('');

  const examples = locale === 'zh' ? EXAMPLES_ZH : EXAMPLES_EN;

  const run = async () => {
    const text = prompt.trim();
    if (!text) return;
    if (!settings.ai.apiKey) {
      pushToast('warning', t('ai.needConfig'));
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await generateRulesFromPrompt({
        prompt: text,
        settings: settings.ai,
        knownTags: tags.map((tag) => tag.name),
        locale,
      });
      setResult(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('ai.title')}
      subtitle={t('ai.subtitle')}
      icon={<Sparkles size={13} />}
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-faint">{t('ai.offline')}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!result || result.rules.length === 0}
              onClick={() => {
                if (!result) return;
                applyAiRules(result.rules, 'append', result.name ?? undefined);
                pushToast('success', t('ai.insert'));
                onClose();
              }}
              className="rounded-md border border-line px-2.5 py-1 text-[10px] text-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              {t('ai.insert')}
            </button>
            <button
              type="button"
              disabled={!result || result.rules.length === 0}
              onClick={() => {
                if (!result) return;
                applyAiRules(result.rules, 'replace', result.name ?? undefined);
                pushToast('success', t('ai.replace'));
                onClose();
              }}
              className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
            >
              {t('ai.replace')}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void run();
          }}
          rows={4}
          placeholder={t('ai.placeholder')}
          className="w-full resize-none rounded-lg border border-line bg-raised px-3 py-2 text-[11px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-accent/50"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-[10px] text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            {loading ? t('ai.generating') : t('ai.generate')}
          </button>
          <span className="flex items-center gap-1 text-[9px] text-faint">
            <Send size={9} />
            Ctrl+Enter
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPrompt(examples[Math.floor(Math.random() * examples.length)])}
            className="rounded border border-line px-2 py-1 text-[9px] text-muted transition-colors hover:text-ink"
          >
            {t('ai.examples')}
          </button>
        </div>

        {error ? (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-danger">
            {t('ai.error', { message: error })}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-faint">
              {t('ai.preview')} · {result.name}
            </p>
            <pre className="max-h-56 overflow-auto rounded-lg border border-line bg-app/80 p-2.5 font-mono text-[10px] leading-relaxed text-ink">
              {result.code}
            </pre>
            <p className={cn('text-[9px]', result.rules.length ? 'text-ok' : 'text-warn')}>
              {result.rules.length ? `${result.rules.length} rules` : t('ai.noRules')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[9px] text-faint">{t('ai.empty')}</p>
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="block w-full rounded border border-line/60 px-2 py-1 text-left text-[9px] text-muted transition-colors hover:border-accent/30 hover:text-ink"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
