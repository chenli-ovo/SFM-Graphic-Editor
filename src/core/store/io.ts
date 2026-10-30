import {
  COMPARE_OPS,
  RULE_TYPES,
  SET_OPS,
  SIDES,
  TIME_UNITS,
  type BoolExpr,
  type CompareOp,
  type EveryRule,
  type HasExpr,
  type IfRule,
  type InputRule,
  type IoOp,
  type Item,
  type ItemCategory,
  type OutputRule,
  type Project,
  type Rule,
  type SetOp,
  type Side,
  type SideSpec,
  type Tag,
  type Template,
  type ThemeState,
  type Settings,
} from '../types';
import { newId } from '../../lib/id';
import { isPlainObject } from '../../lib/utils';
import { DEFAULT_ITEMS, CATEGORIES } from '../data/items';
import { DEFAULT_SETTINGS } from '../data/defaults';
import { DEFAULT_THEME } from '../data/themes';
import { createBuiltinTemplates } from '../data/defaults';

/* ------------------------------------------------------------------ */
/* 导入校验：所有外来 JSON 都必须经过这里，防止坏数据把应用搞崩              */
/* ------------------------------------------------------------------ */

function asSide(value: unknown): Side | null {
  return typeof value === 'string' && (SIDES as readonly string[]).includes(value) ? (value as Side) : null;
}

export function normalizeSideSpec(value: unknown): SideSpec {
  if (!isPlainObject(value)) return { mode: 'none', sides: [] };
  const mode = value.mode === 'list' || value.mode === 'each' ? value.mode : 'none';
  const sides = Array.isArray(value.sides)
    ? value.sides.map(asSide).filter((side): side is Side => side !== null)
    : [];
  return { mode, sides: mode === 'list' ? sides : [] };
}

export function normalizeIoOp(value: unknown): IoOp {
  if (!isPlainObject(value)) {
    return {
      count: null,
      countEach: false,
      retain: null,
      retainEach: false,
      resource: '',
      withClause: null,
      withoutClause: null,
    };
  }
  const numberOrNull = (input: unknown) =>
    typeof input === 'number' && Number.isFinite(input) && input >= 0 ? Math.floor(input) : null;
  return {
    count: numberOrNull(value.count),
    countEach: Boolean(value.countEach),
    retain: numberOrNull(value.retain),
    retainEach: Boolean(value.retainEach),
    resource: typeof value.resource === 'string' ? value.resource : '',
    withClause: typeof value.withClause === 'string' && value.withClause.trim() ? value.withClause : null,
    withoutClause: typeof value.withoutClause === 'string' && value.withoutClause.trim() ? value.withoutClause : null,
  };
}

function normalizeHasExpr(value: Record<string, unknown>): HasExpr {
  const op = typeof value.op === 'string' && (COMPARE_OPS as readonly string[]).includes(value.op)
    ? (value.op as CompareOp)
    : 'gt';
  const setOp = typeof value.setOp === 'string' && (SET_OPS as readonly string[]).includes(value.setOp)
    ? (value.setOp as SetOp)
    : 'overall';
  const roundRobin: 'label' | 'block' | null =
    value.roundRobin === 'label' || value.roundRobin === 'block' ? value.roundRobin : null;
  return {
    kind: 'has',
    setOp,
    labels: Array.isArray(value.labels)
      ? value.labels.filter((label): label is string => typeof label === 'string')
      : [],
    each: Boolean(value.each),
    roundRobin,
    sides: normalizeSideSpec(value.sides),
    slots: typeof value.slots === 'string' ? value.slots : '',
    op,
    value: typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : null,
    resource: typeof value.resource === 'string' ? value.resource : '',
    withClause: typeof value.withClause === 'string' && value.withClause.trim() ? value.withClause : null,
    withoutClause: typeof value.withoutClause === 'string' && value.withoutClause.trim() ? value.withoutClause : null,
    except: Array.isArray(value.except)
      ? value.except.filter((entry): entry is string => typeof entry === 'string')
      : [],
  };
}

export function normalizeBoolExpr(value: unknown, depth = 0): BoolExpr {
  if (!isPlainObject(value) || depth > 12) {
    return { kind: 'const', value: true };
  }
  switch (value.kind) {
    case 'const':
      return { kind: 'const', value: Boolean(value.value) };
    case 'not':
      return { kind: 'not', expr: normalizeBoolExpr(value.expr, depth + 1) };
    case 'and':
    case 'or':
      return {
        kind: value.kind,
        left: normalizeBoolExpr(value.left, depth + 1),
        right: normalizeBoolExpr(value.right, depth + 1),
      };
    case 'redstone': {
      const op = typeof value.op === 'string' && (COMPARE_OPS as readonly string[]).includes(value.op)
        ? (value.op as CompareOp)
        : null;
      const amount = typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : null;
      return { kind: 'redstone', op, value: amount };
    }
    case 'has':
      return normalizeHasExpr(value);
    default:
      return { kind: 'const', value: true };
  }
}

function legacyRef(value: Record<string, unknown>): { labels: string[]; sides: SideSpec } | null {
  const target = value.target;
  if (!isPlainObject(target) || typeof target.kind !== 'string') return null;
  if (target.kind === 'tag' && typeof target.name === 'string' && target.name) {
    return { labels: [target.name], sides: { mode: 'none', sides: [] } };
  }
  if (target.kind === 'block') {
    const face = asSide(target.face);
    return {
      labels: [],
      sides: face ? { mode: 'list', sides: [face] } : { mode: 'none', sides: [] },
    };
  }
  return null;
}

function normalizeIo(value: Record<string, unknown>, type: 'input' | 'output'): InputRule | OutputRule {
  const roundRobin: 'label' | 'block' | null =
    value.roundRobin === 'label' || value.roundRobin === 'block' ? value.roundRobin : null;
  const legacy = legacyRef(value);
  const base = {
    id: typeof value.id === 'string' && value.id ? value.id : newId('rule'),
    collapsed: Boolean(value.collapsed),
    note: typeof value.note === 'string' ? value.note : '',
    ops: Array.isArray(value.ops) ? value.ops.map(normalizeIoOp) : [],
    except: Array.isArray(value.except)
      ? value.except.filter((entry): entry is string => typeof entry === 'string')
      : [],
    labels: Array.isArray(value.labels)
      ? value.labels.filter((label): label is string => typeof label === 'string')
      : legacy?.labels ?? [],
    each: Boolean(value.each),
    roundRobin,
    sides: Array.isArray((value.sides as SideSpec | undefined)?.sides)
      ? normalizeSideSpec(value.sides)
      : legacy?.sides ?? { mode: 'none', sides: [] },
    slots: typeof value.slots === 'string' ? value.slots : '',
  };
  if (type === 'input') {
    return { ...base, type: 'input' };
  }
  return { ...base, type: 'output', emptySlotsIn: Boolean(value.emptySlotsIn) };
}

export function normalizeRule(value: unknown): Rule | null {
  if (!isPlainObject(value) || typeof value.type !== 'string') return null;
  if (!(RULE_TYPES as readonly string[]).includes(value.type)) return null;
  const base = {
    id: typeof value.id === 'string' && value.id ? value.id : newId('rule'),
    collapsed: Boolean(value.collapsed),
    note: typeof value.note === 'string' ? value.note : '',
  };
  switch (value.type) {
    case 'every': {
      const interval = typeof value.interval === 'number' && value.interval > 0 ? Math.floor(value.interval) : null;
      const unit = typeof value.unit === 'string' && (TIME_UNITS as readonly string[]).includes(value.unit)
        ? (value.unit as EveryRule['unit'])
        : 'ticks';
      const offset = typeof value.offset === 'number' && value.offset >= 0 ? Math.floor(value.offset) : null;
      return {
        ...base,
        type: 'every',
        interval,
        global: Boolean(value.global),
        offset,
        unit,
        body: normalizeRules(value.body),
      };
    }
    case 'pulse':
      return { ...base, type: 'pulse', body: normalizeRules(value.body) };
    case 'input':
      return normalizeIo(value, 'input') as InputRule;
    case 'output':
      return normalizeIo(value, 'output') as OutputRule;
    case 'if': {
      const elifs = Array.isArray(value.elifs)
        ? value.elifs
            .filter(isPlainObject)
            .map((raw) => ({
              id: typeof raw.id === 'string' && raw.id ? raw.id : newId('elif'),
              condition: normalizeBoolExpr(raw.condition),
              body: normalizeRules(raw.body),
            }))
        : [];
      const rule: IfRule = {
        ...base,
        type: 'if',
        condition: normalizeBoolExpr(value.condition),
        then: normalizeRules(value.then),
        elifs,
        else: normalizeRules(value.else),
      };
      return rule;
    }
    case 'forget':
      return {
        ...base,
        type: 'forget',
        labels: Array.isArray(value.labels)
          ? value.labels.filter((label): label is string => typeof label === 'string')
          : [],
      };
    default:
      return null;
  }
}

export function normalizeRules(value: unknown): Rule[] {
  if (!Array.isArray(value)) return [];
  const out: Rule[] = [];
  for (const raw of value) {
    const rule = normalizeRule(raw);
    if (rule) out.push(rule);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 标签 / 物品 / 项目 / 模板                                           */
/* ------------------------------------------------------------------ */

export function normalizeTags(value: unknown): Tag[] {
  if (!Array.isArray(value)) return [];
  const out: Tag[] = [];
  for (const raw of value) {
    if (!isPlainObject(raw)) continue;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) continue;
    out.push({
      id: typeof raw.id === 'string' && raw.id ? raw.id : newId('tag'),
      name,
      color: typeof raw.color === 'string' && raw.color ? raw.color : '#38bdf8',
      note: typeof raw.note === 'string' ? raw.note : '',
    });
  }
  return out;
}

export function normalizeItems(value: unknown): Item[] {
  if (!Array.isArray(value)) return DEFAULT_ITEMS.map((item) => ({ ...item }));
  const categories = CATEGORIES.map((category) => category.id);
  const out: Item[] = [];
  for (const raw of value) {
    if (!isPlainObject(raw)) continue;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id) continue;
    const category = typeof raw.category === 'string' && (categories as string[]).includes(raw.category)
      ? (raw.category as ItemCategory)
      : 'misc';
    out.push({
      id,
      name: typeof raw.name === 'string' && raw.name ? raw.name : id,
      category,
      icon: typeof raw.icon === 'string' ? raw.icon : '📦',
      custom: Boolean(raw.custom),
    });
  }
  return out.length ? out : DEFAULT_ITEMS.map((item) => ({ ...item }));
}

function normalizeSnapshot(value: unknown) {
  if (!isPlainObject(value)) return null;
  const rules = normalizeRules(value.rules);
  if (!Array.isArray(value.rules)) return null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : newId('snap'),
    name: typeof value.name === 'string' ? value.name : '快照',
    timestamp: typeof value.timestamp === 'number' ? value.timestamp : Date.now(),
    rules,
    code: typeof value.code === 'string' ? value.code : '',
  };
}

export function normalizeProject(value: unknown): Project | null {
  if (!isPlainObject(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || !Array.isArray(value.rules)) return null;
  const now = Date.now();
  const snapshots = Array.isArray(value.snapshots)
    ? value.snapshots.map(normalizeSnapshot).filter((snap): snap is NonNullable<typeof snap> => snap !== null)
    : [];
  return {
    id: typeof value.id === 'string' && value.id ? value.id : newId('proj'),
    name,
    rules: normalizeRules(value.rules),
    tags: normalizeTags(value.tags),
    items: normalizeItems(value.items),
    snapshots,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
  };
}

export function normalizeTemplate(value: unknown): Template | null {
  if (!isPlainObject(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || !Array.isArray(value.rules)) return null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : newId('tpl'),
    name,
    description: typeof value.description === 'string' ? value.description : '',
    rules: normalizeRules(value.rules),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    builtin: Boolean(value.builtin),
  };
}

export function normalizeSettings(value: unknown): Settings {
  if (!isPlainObject(value)) return { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai } };
  const ai = isPlainObject(value.ai) ? value.ai : {};
  return {
    locale: value.locale === 'en' ? 'en' : 'zh',
    sound: typeof value.sound === 'boolean' ? value.sound : true,
    showMinimap: typeof value.showMinimap === 'boolean' ? value.showMinimap : true,
    ai: {
      baseUrl: typeof ai.baseUrl === 'string' && ai.baseUrl ? ai.baseUrl : DEFAULT_SETTINGS.ai.baseUrl,
      apiKey: typeof ai.apiKey === 'string' ? ai.apiKey : '',
      model: typeof ai.model === 'string' && ai.model ? ai.model : DEFAULT_SETTINGS.ai.model,
    },
  };
}

export function normalizeTheme(value: unknown): ThemeState {
  if (!isPlainObject(value)) return { ...DEFAULT_THEME };
  return {
    mode: value.mode === 'light' || value.mode === 'cyber' ? value.mode : 'dark',
    accent: typeof value.accent === 'string' && value.accent ? value.accent : DEFAULT_THEME.accent,
    customAccent: typeof value.customAccent === 'string' && value.customAccent ? value.customAccent : DEFAULT_THEME.customAccent,
  };
}

/* ------------------------------------------------------------------ */
/* 备份 / 导入                                                         */
/* ------------------------------------------------------------------ */

export interface BackupBundle {
  version: number;
  exportedAt: number;
  projects: Project[];
  templates: Template[];
  theme: ThemeState;
  settings: Settings;
}

export function buildBackup(input: {
  projects: Project[];
  templates: Template[];
  theme: ThemeState;
  settings: Settings;
}): BackupBundle {
  return {
    version: 1,
    exportedAt: Date.now(),
    projects: input.projects,
    templates: input.templates,
    theme: input.theme,
    settings: input.settings,
  };
}

export function parseBackup(text: string): { projects: Project[]; templates: Template[]; theme: ThemeState; settings: Settings } | null {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const projectsRaw = Array.isArray(data.projects) ? data.projects : Array.isArray(data.backup ? (data.backup as Record<string, unknown>).projects : null) ? (data.backup as Record<string, unknown>).projects : null;
    if (!Array.isArray(projectsRaw)) return null;
    const projects: Project[] = [];
    for (const raw of projectsRaw) {
      const project = normalizeProject(raw);
      if (project) projects.push({ ...project, id: newId('proj') });
    }
    if (!projects.length) return null;
    const templates = Array.isArray(data.templates)
      ? data.templates.map(normalizeTemplate).filter((tpl): tpl is Template => tpl !== null)
      : [];
    return {
      projects,
      templates,
      theme: normalizeTheme(data.theme),
      settings: normalizeSettings(data.settings),
    };
  } catch {
    return null;
  }
}

export function parseProjectImport(text: string): { projects: Project[]; templates: Template[] } | null {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const projects: Project[] = [];
    const templates: Template[] = [];

    const projectCandidates: unknown[] = [];
    if (Array.isArray(data.projects)) projectCandidates.push(...data.projects);
    if (isPlainObject(data.project)) projectCandidates.push(data.project);
    if (isPlainObject(data) && typeof data.name === 'string' && Array.isArray(data.rules)) {
      projectCandidates.push(data);
    }
    for (const raw of projectCandidates) {
      const project = normalizeProject(raw);
      if (project) projects.push(project);
    }

    if (isPlainObject(data.template) || (isPlainObject(data) && typeof data.name === 'string' && Array.isArray(data.rules) && !projects.length)) {
      const template = normalizeTemplate(isPlainObject(data.template) ? data.template : data);
      if (template) templates.push(template);
    }

    if (!projects.length && !templates.length) return null;
    return { projects, templates };
  } catch {
    return null;
  }
}

export function defaultTemplatesIfEmpty(templates: Template[]): Template[] {
  return templates.length ? templates : createBuiltinTemplates();
}
