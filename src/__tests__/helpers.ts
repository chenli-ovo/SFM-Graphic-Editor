import type {
  EveryRule,
  ForgetRule,
  HasExpr,
  IfRule,
  InputRule,
  OutputRule,
  PulseRule,
  Side,
  SideSpec,
} from '../core/types';

const BASE = { collapsed: false, note: '' };

export function sides(list: Side[]): SideSpec {
  return { mode: list.length ? 'list' : 'none', sides: list };
}

export function has(over: Partial<HasExpr> & { labels: string[] }): HasExpr {
  return {
    kind: 'has',
    setOp: 'overall',
    each: false,
    roundRobin: null,
    sides: { mode: 'none', sides: [] },
    slots: '',
    op: 'gt',
    value: 0,
    resource: '',
    withClause: null,
    withoutClause: null,
    except: [],
    ...over,
  };
}

export function inputRule(over: Partial<InputRule> = {}): InputRule {
  return {
    ...BASE,
    id: 'in1',
    type: 'input',
    ops: [],
    except: [],
    labels: [],
    each: false,
    roundRobin: null,
    sides: { mode: 'none', sides: [] },
    slots: '',
    ...over,
  };
}

export function outputRule(over: Partial<OutputRule> = {}): OutputRule {
  return {
    ...BASE,
    id: 'out1',
    type: 'output',
    ops: [],
    except: [],
    labels: [],
    each: false,
    roundRobin: null,
    sides: { mode: 'none', sides: [] },
    slots: '',
    emptySlotsIn: false,
    ...over,
  };
}

export function everyRule(over: Partial<EveryRule> = {}): EveryRule {
  return {
    ...BASE,
    id: 'every1',
    type: 'every',
    interval: 20,
    global: false,
    offset: null,
    unit: 'ticks',
    body: [],
    ...over,
  };
}

export function pulseRule(over: Partial<PulseRule> = {}): PulseRule {
  return { ...BASE, id: 'pulse1', type: 'pulse', body: [], ...over };
}

export function ifRule(over: Partial<IfRule> = {}): IfRule {
  return {
    ...BASE,
    id: 'if1',
    type: 'if',
    condition: has({ labels: ['a'] }),
    then: [],
    elifs: [],
    else: [],
    ...over,
  };
}

export function forgetRule(over: Partial<ForgetRule> = {}): ForgetRule {
  return { ...BASE, id: 'forget1', type: 'forget', labels: [], ...over };
}
