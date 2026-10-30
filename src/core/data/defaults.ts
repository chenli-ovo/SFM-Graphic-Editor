import type { InputRule, OutputRule, Project, Rule, Settings, Tag, Template } from '../types';
import { newId } from '../../lib/id';
import { DEFAULT_ITEMS } from './items';
import { DEFAULT_THEME } from './themes';
import { createStarterRules, defaultHasExpr, emptyOp } from '../rules/tree';

export const DEFAULT_TAGS: Tag[] = [
  { id: newId('tag'), name: 'ores', color: '#38bdf8', note: '所有原矿' },
  { id: newId('tag'), name: 'storage', color: '#a78bfa', note: '中央仓库' },
  { id: newId('tag'), name: 'furnace', color: '#f59e0b', note: '熔炉组' },
  { id: newId('tag'), name: 'hopper', color: '#34d399', note: '漏斗/缓存' },
];

export const DEFAULT_SETTINGS: Settings = {
  locale: 'zh',
  sound: true,
  showMinimap: true,
  ai: {
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat',
  },
};

export function createDefaultProject(name = '熔炼工厂'): Project {
  const now = Date.now();
  const tags = DEFAULT_TAGS.map((t) => ({ ...t, id: newId('tag') }));
  return {
    id: newId('proj'),
    name,
    rules: createStarterRules(tags),
    tags,
    items: DEFAULT_ITEMS.map((i) => ({ ...i })),
    snapshots: [],
    createdAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* 内置模板                                                            */
/* ------------------------------------------------------------------ */

interface IoOptions {
  count?: number | null;
  slots?: string;
  sides?: 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west' | 'none';
  emptySlotsIn?: boolean;
}

const base = () => ({ id: newId('rule'), collapsed: false, note: '' });

function input(label: string, options: IoOptions = {}): InputRule {
  return {
    ...base(),
    type: 'input',
    ops: options.count ? [{ ...emptyOp(), count: options.count }] : [],
    except: [],
    labels: [label],
    each: false,
    roundRobin: null,
    sides: options.sides && options.sides !== 'none' ? { mode: 'list', sides: [options.sides] } : { mode: 'none', sides: [] },
    slots: options.slots ?? '',
  };
}

function output(label: string, options: IoOptions = {}): OutputRule {
  return {
    ...base(),
    type: 'output',
    ops: options.count ? [{ ...emptyOp(), count: options.count }] : [],
    except: [],
    labels: [label],
    each: false,
    roundRobin: null,
    sides: options.sides && options.sides !== 'none' ? { mode: 'list', sides: [options.sides] } : { mode: 'none', sides: [] },
    slots: options.slots ?? '',
    emptySlotsIn: options.emptySlotsIn ?? false,
  };
}

export function createBuiltinTemplates(): Template[] {
  const now = Date.now();
  return [
    {
      id: newId('tpl'),
      name: '每秒熔炉供料',
      description: '每秒从 ores 标签抽取物品送入顶部熔炉',
      createdAt: now,
      builtin: true,
      rules: [
        {
          ...base(),
          type: 'every',
          interval: 20,
          global: false,
          offset: null,
          unit: 'ticks',
          note: '每秒从矿石标签抽取物品',
          body: [input('ores', { slots: '0-5' }), output('furnace', { sides: 'top' })],
        } as Rule,
      ],
    },
    {
      id: newId('tpl'),
      name: '红石脉冲抽取',
      description: '红石脉冲时把下方漏斗物品输出到顶部',
      createdAt: now,
      builtin: true,
      rules: [
        {
          ...base(),
          type: 'pulse',
          note: '红石脉冲触发',
          body: [input('hopper', { sides: 'bottom' }), output('furnace', { sides: 'top' })],
        } as Rule,
      ],
    },
    {
      id: newId('tpl'),
      name: '条件分拣器',
      description: 'ores 超过 64 个时输出到 storage，否则从东侧输入',
      createdAt: now,
      builtin: true,
      rules: [
        {
          ...base(),
          type: 'if',
          condition: { ...defaultHasExpr(), labels: ['ores'], op: 'gt', value: 64 },
          then: [output('storage')],
          elifs: [],
          else: [input('hopper', { sides: 'east' })],
        } as Rule,
      ],
    },
    {
      id: newId('tpl'),
      name: '每 Tick 高速吞吐（慎用）',
      description: '展示高频 every 规则的性能告警场景',
      createdAt: now,
      builtin: true,
      rules: [
        {
          ...base(),
          type: 'every',
          interval: 1,
          global: false,
          offset: null,
          unit: 'ticks',
          note: '高频规则：注意 TPS 开销',
          body: [
            input('ores', { sides: 'north', slots: '0-2' }),
            output('furnace', { sides: 'south' }),
            input('hopper', { sides: 'west' }),
            output('storage', { sides: 'east' }),
          ],
        } as Rule,
      ],
    },
  ];
}

export const DEFAULT_THEME_STATE = DEFAULT_THEME;
