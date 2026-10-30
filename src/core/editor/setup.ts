import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import type { Locale, ThemeMode } from '../types';
import { breakpointGutter } from './breakpoints';
import type { CompletionItem } from './completion';
import { createSfmCompletion } from './completion';
import { sfmFoldService } from './fold';
import { sfmLanguage } from './language';
import { createSfmLinter } from './linter';
import { createEditorTheme } from './theme';

export interface EditorSetupOptions {
  mode: ThemeMode;
  accent: string;
  tags: () => string[];
  items: () => CompletionItem[];
  knownItems: () => Iterable<string>;
  locale: () => Locale;
  defineTag: (name: string) => void;
  onBreakpoints: (lines: number[]) => void;
  onChange: (code: string) => void;
  onSave?: () => void;
  skipTheme?: boolean;
}

/** 组装 CodeMirror 6 的完整编辑体验（行号、断点、折叠、补全、诊断、主题） */
export function createEditorExtensions(options: EditorSetupOptions): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    breakpointGutter({ onChange: options.onBreakpoints }),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    rectangularSelection(),
    highlightSelectionMatches(),
    history(),
    autocompletion({
      override: [createSfmCompletion({ tags: options.tags, items: options.items })],
      activateOnTyping: true,
      maxRenderedOptions: 40,
      icons: false,
    }),
    keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          options.onSave?.();
          return true;
        },
      },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
    sfmLanguage,
    sfmFoldService,
    createSfmLinter({
      knownTags: options.tags,
      knownItems: options.knownItems,
      locale: options.locale,
      defineTag: options.defineTag,
    }),
    ...(options.skipTheme ? [] : [createEditorTheme(options.mode, options.accent)]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange(update.state.doc.toString());
    }),
  ];
}
