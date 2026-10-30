import type { Action, Diagnostic as CMDiagnostic } from '@codemirror/lint';
import { linter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { Locale } from '../types';
import { parseProgram } from '../parser';

export interface LinterOptions {
  knownTags: () => string[];
  locale: () => Locale;
  defineTag?: (name: string) => void;
}

/**
 * 把 SFM 解析器的诊断映射到 CodeMirror Linter：
 * - severity error → 红色波浪线（占位符未填写）
 * - severity warning → 黄色波浪线（标签未定义）
 * - 未定义标签提供「一键创建标签」快速修复
 */
export function createSfmLinter(options: LinterOptions): Extension {
  return linter(
    (view) => {
      const code = view.state.doc.toString();
      if (!code.trim()) return [];
      const result = parseProgram(code, { knownTags: options.knownTags(), locale: options.locale() });
      return result.diagnostics.map((diagnostic): CMDiagnostic => {
        const from = Math.max(0, Math.min(diagnostic.from, code.length));
        const to = Math.max(from, Math.min(diagnostic.to || from + 1, code.length));
        const actions: Action[] = [];
        if (diagnostic.fix?.kind === 'define-tag' && diagnostic.fix.tagName && options.defineTag) {
          const tagName = diagnostic.fix.tagName;
          actions.push({
            name: `创建标签 "${tagName}"`,
            apply: (target) => {
              options.defineTag?.(tagName);
              target.dispatch({});
            },
          });
        }
        return {
          from,
          to,
          severity: diagnostic.severity === 'error' ? 'error' : 'warning',
          message: diagnostic.message,
          source: 'sfm',
          actions: actions.length ? actions : undefined,
        };
      });
    },
    { delay: 280 },
  );
}
