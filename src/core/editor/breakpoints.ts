import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { GutterMarker, gutter } from '@codemirror/view';

export const toggleBreakpointEffect = StateEffect.define<number>();
export const setBreakpointsEffect = StateEffect.define<number[]>();

const breakpointField = StateField.define<number[]>({
  create: () => [],
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(toggleBreakpointEffect)) {
        next = next.includes(effect.value)
          ? next.filter((line) => line !== effect.value)
          : [...next, effect.value].sort((a, b) => a - b);
      } else if (effect.is(setBreakpointsEffect)) {
        next = [...new Set(effect.value)].sort((a, b) => a - b);
      }
    }
    return next;
  },
});

class BreakpointMarker extends GutterMarker {
  toDOM(): HTMLElement {
    const dot = document.createElement('span');
    dot.className = 'cm-breakpoint-dot';
    return dot;
  }
}

const marker = new BreakpointMarker();

export interface BreakpointOptions {
  onChange?: (lines: number[]) => void;
}

/** 行号左侧的断点列：点击切换，返回的扩展可直接放进 EditorState */
export function breakpointGutter(options: BreakpointOptions = {}): Extension[] {
  return [
    breakpointField,
    gutter({
      class: 'cm-breakpoint-gutter',
      lineMarker(view, line) {
        const lineNumber = view.state.doc.lineAt(line.from).number;
        return view.state.field(breakpointField).includes(lineNumber) ? marker : null;
      },
      initialSpacer: () => marker,
      domEventHandlers: {
        mousedown(view, line) {
          const lineNumber = view.state.doc.lineAt(line.from).number;
          view.dispatch({ effects: toggleBreakpointEffect.of(lineNumber) });
          options.onChange?.(view.state.field(breakpointField));
          return true;
        },
      },
    }),
  ];
}

export function breakpointsOf(state: { field: (field: StateField<number[]>) => number[] }): number[] {
  try {
    return state.field(breakpointField);
  } catch {
    return [];
  }
}
