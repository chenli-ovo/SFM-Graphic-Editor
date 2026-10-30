import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';

const KEYWORD_SNIPPETS: Completion[] = [
  { label: 'every', type: 'keyword', detail: '定时块', apply: 'every 20 ticks do\n  \nend' },
  { label: 'every redstone pulse', type: 'keyword', detail: '红石脉冲块', apply: 'every redstone pulse do\n  \nend' },
  { label: 'input from', type: 'keyword', detail: '输入规则', apply: 'input from ' },
  { label: 'output to', type: 'keyword', detail: '输出规则', apply: 'output to ' },
  { label: 'if', type: 'keyword', detail: '条件块', apply: 'if a has > 0 then\n  \nend' },
  { label: 'forget', type: 'keyword', detail: '清除输入缓存', apply: 'forget ' },
  { label: 'slots', type: 'keyword', detail: '槽位范围', apply: 'slots ' },
  { label: 'each side', type: 'keyword', detail: '所有面', apply: 'each side' },
  { label: 'round robin by label', type: 'keyword', detail: '按标签轮询', apply: 'round robin by label' },
];

function contextBefore(context: CompletionContext): string {
  const line = context.state.doc.lineAt(context.pos);
  return line.text.slice(0, context.pos - line.from);
}

export interface CompletionData {
  tags: () => string[];
  items: () => string[];
}

/**
 * SFM 自动补全（对齐官方语法）：
 * - from/to/has 之后 → 标签名
 * - input/output/retain/except/with/without 之后 → 物品 ID
 * - side 附近 → 朝向名
 * - 其他位置 → 关键字片段与标签
 */
export function createSfmCompletion(data: CompletionData): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w:.*-]*/);
    if (!word) return null;
    const prefix = contextBefore(context);
    const from = word.from;

    if (/\b(?:from|to)\s+[^,]*$/.test(prefix) && !/\b(?:from|to)\s+[^,]*\b(?:side|slots?)\b/.test(prefix)) {
      return {
        from,
        options: data.tags().map((name) => ({ label: name, type: 'variable', detail: '标签' })),
        validFor: /^[\w.-]*$/,
      };
    }

    if (/\b(?:input|output|retain|except|with|without)\s+[^,]*$/.test(prefix)) {
      return {
        from,
        options: data.items().map((id) => ({ label: id, type: 'constant', detail: '物品' })),
        validFor: /^[\w:.*-]*$/,
      };
    }

    if (word.from === word.to && !context.explicit) return null;

    return {
      from,
      options: [
        ...KEYWORD_SNIPPETS,
        ...data.tags().map((name) => ({
          label: name,
          type: 'variable' as const,
          detail: '标签',
          apply: name,
        })),
      ],
      validFor: /^[\w:"(). ,-]*$/,
    };
  };
}
