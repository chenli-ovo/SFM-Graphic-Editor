import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { setBreakpointsEffect } from '../../core/editor/breakpoints';
import { createEditorExtensions } from '../../core/editor/setup';
import { createEditorTheme } from '../../core/editor/theme';
import { registryIdSet } from '../../core/data/registry';
import { getActiveProject, useStore } from '../../core/store/store';
import type { ThemeMode } from '../../core/types';

const simLineEffect = StateEffect.define<number | null>();

const simLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(simLineEffect)) continue;
      if (effect.value == null) {
        next = Decoration.none;
      } else {
        const line = tr.state.doc.line(Math.min(Math.max(1, effect.value), tr.state.doc.lines));
        next = Decoration.set([Decoration.line({ class: 'cm-simActiveLine' }).range(line.from)]);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export interface CodeEditorHandle {
  jumpToLine: (line: number) => void;
  revealLine: (line: number, endLine?: number) => void;
  focus: () => void;
  setSimLine: (line: number | null) => void;
  getView: () => EditorView | null;
}

interface CodeEditorProps {
  code: string;
  mode: ThemeMode;
  accent: string;
  simLine?: number | null;
  onChange: (code: string) => void;
  onCursor?: (line: number, column: number) => void;
  onBreakpoints?: (lines: number[]) => void;
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const propsRef = useRef(props);
  propsRef.current = props;

  useImperativeHandle(ref, () => ({
    jumpToLine(line: number) {
      const view = viewRef.current;
      if (!view) return;
      const target = Math.min(Math.max(1, line), view.state.doc.lines);
      const info = view.state.doc.line(target);
      view.dispatch({
        selection: { anchor: info.from },
        effects: EditorView.scrollIntoView(info.from, { y: 'center' }),
      });
      view.focus();
    },
    revealLine(line: number, endLine?: number) {
      const view = viewRef.current;
      if (!view) return;
      const doc = view.state.doc;
      const startLine = Math.min(Math.max(1, line), doc.lines);
      const end = Math.min(Math.max(startLine, endLine ?? startLine), doc.lines);
      const from = doc.line(startLine).from;
      const to = doc.line(end).to;
      view.dispatch({
        selection: { anchor: from, head: to },
        effects: EditorView.scrollIntoView(to, { y: 'center' }),
      });
      view.focus();
    },
    focus() {
      viewRef.current?.focus();
    },
    setSimLine(line: number | null) {
      viewRef.current?.dispatch({ effects: simLineEffect.of(line) });
    },
    getView() {
      return viewRef.current;
    },
  }));

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;
    const { mode, accent } = propsRef.current;

    const extensions: Extension[] = [
      themeCompartment.current.of(createEditorTheme(mode, accent)),
      ...createEditorExtensions({
        mode,
        accent,
        tags: () => getActiveProject(useStore.getState())?.tags.map((tag) => tag.name) ?? [],
        items: () =>
          getActiveProject(useStore.getState())?.items.map((item) => ({ id: item.id, name: item.name })) ?? [],
        knownItems: () => {
          const project = getActiveProject(useStore.getState());
          const ids = new Set(registryIdSet());
          project?.items.forEach((item) => ids.add(item.id));
          return ids;
        },
        locale: () => useStore.getState().settings.locale,
        defineTag: (name) => useStore.getState().addTag(name),
        onBreakpoints: (lines) => propsRef.current.onBreakpoints?.(lines),
        onChange: (code) => propsRef.current.onChange(code),
        onSave: () => useStore.getState().forceSyncFromCode(),
        skipTheme: true,
      }),
      simLineField,
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet && !update.docChanged) return;
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        propsRef.current.onCursor?.(line.number, head - line.from + 1);
      }),
    ];

    const state = EditorState.create({ doc: propsRef.current.code, extensions });
    const view = new EditorView({ state, parent });
    viewRef.current = view;
    const breakpoints = useStore.getState().breakpoints;
    if (breakpoints.length > 0) {
      view.dispatch({ effects: setBreakpointsEffect.of(breakpoints) });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 只在挂载时创建一次，后续通过 compartment / propsRef 更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { code, mode, accent, simLine } = props;

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === code) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: code } });
  }, [code]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.current.reconfigure(createEditorTheme(mode, accent)),
    });
  }, [mode, accent]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: simLineEffect.of(simLine ?? null) });
  }, [simLine]);

  return <div ref={hostRef} className="h-full min-h-0 overflow-hidden" data-editor-root="true" />;
});
