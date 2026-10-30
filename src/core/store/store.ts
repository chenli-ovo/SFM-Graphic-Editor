import { create } from 'zustand';
import type {
  AiSettings,
  Diagnostic,
  Item,
  ItemCategory,
  Locale,
  Project,
  Rule,
  RuleType,
  Settings,
  Snapshot,
  Tag,
  Template,
  ThemeState,
} from '../types';
import { hasErrors, parseProgram, serializeProgram } from '../parser';
import {
  appendToBody,
  cloneRuleDeep,
  collectTags,
  createRule,
  findRule,
  insertAfterRule,
  moveRuleInTree,
  removeRuleInTree,
  replaceSiblings,
  updateRuleInTree,
} from '../rules/tree';
import type { BodyKey } from '../rules/tree';
import { replaceInRules } from '../rules/search';
import type { ReplaceMode } from '../rules/search';
import {
  createBuiltinTemplates,
  createDefaultProject,
  DEFAULT_SETTINGS,
  DEFAULT_THEME_STATE,
} from '../data/defaults';
import { ACCENTS, applyTheme } from '../data/themes';
import { registryIdSet } from '../data/registry';
import { newId } from '../../lib/id';
import { copyText, downloadText, safeFileName } from '../../lib/utils';
import { buildGiveCommand } from '../../lib/give';
import { buildShareUrl, encodeShare, type SharePayload } from '../../lib/share';
import {
  buildBackup,
  normalizeProject,
  normalizeSettings,
  normalizeTemplate,
  normalizeTheme,
  parseBackup,
  parseProjectImport,
} from './io';
import { loadWorkspace, saveWorkspace, type PersistedState } from './persistence';

export type SidebarTab = 'tags' | 'items' | 'templates' | 'theme';
export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface HistoryEntry {
  rules: Rule[];
  name: string;
  /** 批量重命名标签 / 物品时一并记录，保证撤销能还原 */
  tags?: Tag[];
  items?: Item[];
}

function historyOf(project: Project): HistoryEntry {
  return { rules: project.rules, name: project.name, tags: project.tags, items: project.items };
}

const MAX_HISTORY = 100;
const MAX_SNAPSHOTS = 30;
const MAX_TOASTS = 4;

/** 忽略 id / 折叠 / 备注后比较规则内容，避免无意义的撤销记录 */
function contentSignature(rules: Rule[]): string {
  return JSON.stringify(rules, (key, value) =>
    key === 'id' || key === 'collapsed' || key === 'note' ? undefined : value,
  );
}

function knownItemIds(project: Project): Set<string> {
  const ids = new Set(registryIdSet());
  project.items.forEach((item) => ids.add(item.id));
  return ids;
}

function computeDiagnostics(
  code: string,
  project: Project,
  locale: Locale,
): {
  diagnostics: Diagnostic[];
  parseFailed: boolean;
  lineToRule: Record<number, string>;
  ruleLines: Record<string, { start: number; end: number }>;
} {
  const result = parseProgram(code, {
    knownTags: project.tags.map((tag) => tag.name),
    knownItems: knownItemIds(project),
    previousRules: project.rules,
    locale,
  });
  return {
    diagnostics: result.diagnostics,
    parseFailed: hasErrors(result.diagnostics),
    lineToRule: result.lineToRule,
    ruleLines: result.ruleLines,
  };
}

export interface AppStore {
  hydrated: boolean;
  projects: Project[];
  activeProjectId: string;
  templates: Template[];
  theme: ThemeState;
  settings: Settings;
  sidebarTab: SidebarTab;
  sidebarCollapsed: boolean;
  selectedRuleId: string | null;
  code: string;
  diagnostics: Diagnostic[];
  parseFailed: boolean;
  codeSource: 'form' | 'code';
  past: HistoryEntry[];
  future: HistoryEntry[];
  toasts: Toast[];
  breakpoints: number[];
  /** 规则 id → 代码行范围（1 基） */
  ruleLines: Record<string, { start: number; end: number }>;
  /** 代码行号（1 基）→ 规则 id */
  lineToRule: Record<number, string>;
  /** 点击卡片时自增，EditorPanel 监听后滚动到对应行 */
  revealSeq: number;
  revealRuleId: string | null;
  /** 代码光标选中规则时自增，RuleCard 监听后滚动到卡片 */
  selectSeq: number;

  hydrate: () => Promise<void>;
  setActiveProject: (id: string) => void;
  createProject: (name?: string) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;

  addRule: (type: RuleType, parentId?: string | null, bodyKey?: BodyKey) => void;
  insertRules: (rules: Rule[], parentId?: string | null, bodyKey?: BodyKey) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  removeRule: (id: string) => void;
  duplicateRule: (id: string) => void;
  moveRule: (id: string, dir: -1 | 1) => void;
  reorderRules: (original: Rule[], sorted: Rule[]) => void;
  clearRules: () => void;
  toggleCollapse: (id: string) => void;
  setSelectedRule: (id: string | null) => void;
  revealRule: (id: string) => void;
  selectRuleFromCode: (id: string | null) => void;

  applyCode: (code: string) => void;
  forceSyncFromCode: () => boolean;
  recomputeDiagnostics: () => void;
  applyTagFixes: () => number;
  /** 批量替换标签名 / 物品 ID；返回替换处数 */
  replaceAll: (mode: ReplaceMode, from: string, to: string) => number;

  undo: () => void;
  redo: () => void;
  saveSnapshot: (name?: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;

  addTag: (name: string, color?: string, note?: string) => boolean;
  updateTag: (id: string, patch: Partial<Tag>) => boolean;
  removeTag: (id: string) => void;

  addItem: (item: Omit<Item, 'custom'>) => boolean;
  updateItem: (id: string, patch: Partial<Item>) => void;
  removeItem: (id: string) => void;

  saveRulesAsTemplate: (ruleIds: string[], name: string, description?: string) => boolean;
  insertTemplate: (templateId: string, parentId?: string | null, bodyKey?: BodyKey) => void;
  deleteTemplate: (templateId: string) => void;
  importTemplateText: (text: string) => boolean;

  updateSettings: (patch: Partial<Settings>) => void;
  updateAi: (patch: Partial<AiSettings>) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (patch: Partial<ThemeState>) => void;
  setBreakpoints: (lines: number[]) => void;

  setSidebarTab: (tab: SidebarTab) => void;
  toggleSidebar: () => void;
  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: string) => void;

  exportSfm: () => void;
  shareProject: () => Promise<void>;
  copyGiveCommand: () => Promise<void>;
  importSharedProject: (payload: SharePayload) => void;
  exportProjectJson: () => void;
  exportBackup: () => void;
  importBackup: (text: string) => boolean;
  importProjectText: (text: string) => boolean;
  applyAiRules: (rules: Rule[], mode: 'append' | 'replace', programName?: string) => void;
}

function snapshotState(state: AppStore): PersistedState {
  return {
    version: 1,
    projects: state.projects,
    activeProjectId: state.activeProjectId,
    templates: state.templates,
    theme: state.theme,
    settings: state.settings,
    sidebarTab: state.sidebarTab,
    sidebarCollapsed: state.sidebarCollapsed,
    savedAt: Date.now(),
  };
}

function activeProjectOf(state: AppStore): Project | undefined {
  return state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];
}

export function getActiveProject(state: AppStore): Project | undefined {
  return activeProjectOf(state);
}

export const useStore = create<AppStore>()((set, get) => {
  const active = (): Project | undefined => activeProjectOf(get());

  /** 提交规则变更：写入项目、重新生成代码、刷新诊断，并记录撤销历史 */
  const commitRules = (
    rules: Rule[],
    options: { name?: string; history?: boolean; code?: string; selectRuleId?: string | null } = {},
  ): void => {
    const state = get();
    const project = active();
    if (!project) return;
    const nextProject: Project = {
      ...project,
      name: options.name ?? project.name,
      rules,
      updatedAt: Date.now(),
    };
    const code = options.code ?? serializeProgram(nextProject.name, nextProject.rules);
    const { diagnostics, parseFailed, lineToRule, ruleLines } = computeDiagnostics(
      code,
      nextProject,
      state.settings.locale,
    );
    const history = options.history === false ? null : {
      past: [...state.past, historyOf(project)].slice(-MAX_HISTORY),
      future: [] as HistoryEntry[],
    };
    set({
      projects: state.projects.map((p) => (p.id === nextProject.id ? nextProject : p)),
      code,
      diagnostics,
      parseFailed,
      lineToRule,
      ruleLines,
      codeSource: options.code ? 'code' : 'form',
      ...(options.selectRuleId !== undefined ? { selectedRuleId: options.selectRuleId } : {}),
      ...(history ?? {}),
    });
  };

  /** 只改项目字段（标签 / 物品 / 快照），代码不变但诊断要刷新 */
  const patchProject = (patch: Partial<Project>, recompute = true): void => {
    const state = get();
    const project = active();
    if (!project) return;
    const nextProject: Project = { ...project, ...patch, updatedAt: Date.now() };
    const { diagnostics, parseFailed, lineToRule, ruleLines } = recompute
      ? computeDiagnostics(state.code, nextProject, state.settings.locale)
      : {
          diagnostics: state.diagnostics,
          parseFailed: state.parseFailed,
          lineToRule: state.lineToRule,
          ruleLines: state.ruleLines,
        };
    set({
      projects: state.projects.map((p) => (p.id === nextProject.id ? nextProject : p)),
      diagnostics,
      parseFailed,
      lineToRule,
      ruleLines,
    });
  };

  const replaceProjects = (projects: Project[], activeProjectId: string): void => {
    const state = get();
    const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
    const code = serializeProgram(project.name, project.rules);
    const { diagnostics, parseFailed, lineToRule, ruleLines } = computeDiagnostics(
      code,
      project,
      state.settings.locale,
    );
    set({
      projects,
      activeProjectId: project.id,
      code,
      diagnostics,
      parseFailed,
      lineToRule,
      ruleLines,
      codeSource: 'form',
      past: [],
      future: [],
      selectedRuleId: null,
      breakpoints: [],
    });
  };

  return {
    hydrated: false,
    projects: [],
    activeProjectId: '',
    templates: [],
    theme: DEFAULT_THEME_STATE,
    settings: DEFAULT_SETTINGS,
    sidebarTab: 'tags',
    sidebarCollapsed: false,
    selectedRuleId: null,
    code: '',
    diagnostics: [],
    parseFailed: false,
    codeSource: 'form',
    past: [],
    future: [],
    toasts: [],
    breakpoints: [],
    ruleLines: {},
    lineToRule: {},
    revealSeq: 0,
    revealRuleId: null,
    selectSeq: 0,

    async hydrate() {
      if (get().hydrated) return;
      const persisted = await loadWorkspace();
      let projects: Project[] = [];
      let templates: Template[] = [];
      let theme: ThemeState = DEFAULT_THEME_STATE;
      let settings: Settings = DEFAULT_SETTINGS;
      let activeProjectId = '';
      let sidebarTab: SidebarTab = 'tags';
      let sidebarCollapsed = false;

      if (persisted) {
        projects = Array.isArray(persisted.projects)
          ? persisted.projects.map(normalizeProject).filter((p): p is Project => p !== null)
          : [];
        templates = Array.isArray(persisted.templates)
          ? persisted.templates.map(normalizeTemplate).filter((t): t is Template => t !== null)
          : [];
        theme = normalizeTheme(persisted.theme);
        settings = normalizeSettings(persisted.settings);
        activeProjectId = typeof persisted.activeProjectId === 'string' ? persisted.activeProjectId : '';
        sidebarTab = ['tags', 'items', 'templates', 'theme'].includes(persisted.sidebarTab)
          ? (persisted.sidebarTab as SidebarTab)
          : 'tags';
        sidebarCollapsed = Boolean(persisted.sidebarCollapsed);
      }

      if (!projects.length) projects = [createDefaultProject()];
      if (!templates.length) templates = createBuiltinTemplates();
      if (!projects.some((p) => p.id === activeProjectId)) activeProjectId = projects[0].id;

      const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
      const code = serializeProgram(project.name, project.rules);
      const { diagnostics, parseFailed, lineToRule, ruleLines } = computeDiagnostics(
        code,
        project,
        settings.locale,
      );

      set({
        hydrated: true,
        projects,
        activeProjectId,
        templates,
        theme,
        settings,
        sidebarTab,
        sidebarCollapsed,
        code,
        diagnostics,
        parseFailed,
        lineToRule,
        ruleLines,
        codeSource: 'form',
        past: [],
        future: [],
        toasts: [],
        breakpoints: [],
      });
      applyTheme(theme);
    },

    setActiveProject(id) {
      const state = get();
      const project = state.projects.find((p) => p.id === id);
      if (!project) return;
      const code = serializeProgram(project.name, project.rules);
      const { diagnostics, parseFailed, lineToRule, ruleLines } = computeDiagnostics(
        code,
        project,
        state.settings.locale,
      );
      set({
        activeProjectId: id,
        code,
        diagnostics,
        parseFailed,
        lineToRule,
        ruleLines,
        codeSource: 'form',
        past: [],
        future: [],
        selectedRuleId: null,
        breakpoints: [],
      });
    },

    createProject(name = '新项目') {
      const state = get();
      const base = createDefaultProject(name);
      const project: Project = {
        ...base,
        id: newId('proj'),
        rules: [],
        snapshots: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      set({
        projects: [...state.projects, project],
        activeProjectId: project.id,
        code: serializeProgram(project.name, project.rules),
        diagnostics: [],
        parseFailed: false,
        lineToRule: {},
        ruleLines: {},
        codeSource: 'form',
        past: [],
        future: [],
        selectedRuleId: null,
        breakpoints: [],
      });
      get().pushToast('success', `已创建项目「${project.name}」`);
    },

    deleteProject(id) {
      const state = get();
      if (state.projects.length <= 1) {
        get().pushToast('warning', '至少保留一个项目');
        return;
      }
      const remaining = state.projects.filter((p) => p.id !== id);
      replaceProjects(remaining, state.activeProjectId === id ? remaining[0].id : state.activeProjectId);
      get().pushToast('info', '项目已删除');
    },

    renameProject(id, name) {
      const state = get();
      const trimmed = name.trim();
      if (!trimmed) return;
      const project = state.projects.find((p) => p.id === id);
      if (!project) return;
      if (project.id !== state.activeProjectId) {
        const nextProject = { ...project, name: trimmed, updatedAt: Date.now() };
        set({ projects: state.projects.map((p) => (p.id === id ? nextProject : p)) });
        return;
      }
      commitRules(project.rules, { name: trimmed });
    },

    addRule(type, parentId, bodyKey = 'body') {
      const project = active();
      if (!project) return;
      const rule = createRule(type);
      const rules = parentId
        ? appendToBody(project.rules, parentId, bodyKey, rule)
        : [...project.rules, rule];
      commitRules(rules, { selectRuleId: rule.id });
    },

    insertRules(rules, parentId, bodyKey = 'body') {
      const project = active();
      if (!project) return;
      let next = project.rules;
      for (const rule of rules) {
        next = parentId ? appendToBody(next, parentId, bodyKey, rule) : [...next, rule];
      }
      commitRules(next, { selectRuleId: rules[rules.length - 1]?.id ?? null });
    },

    updateRule(id, patch) {
      const project = active();
      if (!project) return;
      commitRules(updateRuleInTree(project.rules, id, patch));
    },

    removeRule(id) {
      const project = active();
      if (!project) return;
      commitRules(removeRuleInTree(project.rules, id), {
        selectRuleId: get().selectedRuleId === id ? null : get().selectedRuleId,
      });
      get().pushToast('info', '规则已删除');
    },

    duplicateRule(id) {
      const project = active();
      if (!project) return;
      const rule = findRule(project.rules, id);
      if (!rule) return;
      const copy = cloneRuleDeep(rule);
      commitRules(insertAfterRule(project.rules, id, copy), { selectRuleId: copy.id });
    },

    moveRule(id, dir) {
      const project = active();
      if (!project) return;
      commitRules(moveRuleInTree(project.rules, id, dir));
    },

    reorderRules(original, sorted) {
      const project = active();
      if (!project) return;
      commitRules(replaceSiblings(project.rules, original, sorted));
    },

    clearRules() {
      const project = active();
      if (!project) return;
      commitRules([], { selectRuleId: null });
      get().pushToast('info', '已清空所有规则');
    },

    toggleCollapse(id) {
      const state = get();
      const project = active();
      if (!project) return;
      const rule = findRule(project.rules, id);
      if (!rule) return;
      const nextProject = {
        ...project,
        rules: updateRuleInTree(project.rules, id, { collapsed: !rule.collapsed }),
      };
      set({ projects: state.projects.map((p) => (p.id === nextProject.id ? nextProject : p)) });
    },

    setSelectedRule(id) {
      set({ selectedRuleId: id });
    },

    revealRule(id) {
      set({ selectedRuleId: id, revealRuleId: id, revealSeq: get().revealSeq + 1 });
    },

    selectRuleFromCode(id) {
      const state = get();
      if (state.selectedRuleId === id) return;
      set({ selectedRuleId: id, selectSeq: state.selectSeq + 1 });
    },

    applyCode(code) {
      const state = get();
      const project = active();
      if (!project) return;
      const parsed = parseProgram(code, {
        knownTags: project.tags.map((t) => t.name),
        previousRules: project.rules,
        locale: state.settings.locale,
      });
      if (hasErrors(parsed.diagnostics)) {
        set({
          code,
          diagnostics: parsed.diagnostics,
          parseFailed: true,
          lineToRule: parsed.lineToRule,
          ruleLines: parsed.ruleLines,
          codeSource: 'code',
        });
        return;
      }
      const name = parsed.programName?.trim() || project.name;
      const changed = name !== project.name || contentSignature(parsed.rules) !== contentSignature(project.rules);
      const nextProject: Project = { ...project, name, rules: parsed.rules, updatedAt: Date.now() };
      set({
        projects: state.projects.map((p) => (p.id === nextProject.id ? nextProject : p)),
        code,
        diagnostics: parsed.diagnostics,
        parseFailed: false,
        lineToRule: parsed.lineToRule,
        ruleLines: parsed.ruleLines,
        codeSource: 'code',
        ...(changed
          ? {
              past: [...state.past, historyOf(project)].slice(-MAX_HISTORY),
              future: [],
            }
          : {}),
      });
    },

    forceSyncFromCode() {
      const state = get();
      const project = active();
      if (!project) return false;
      const parsed = parseProgram(state.code, {
        knownTags: project.tags.map((t) => t.name),
        previousRules: project.rules,
        locale: state.settings.locale,
      });
      if (hasErrors(parsed.diagnostics)) {
        set({
          diagnostics: parsed.diagnostics,
          parseFailed: true,
          lineToRule: parsed.lineToRule,
          ruleLines: parsed.ruleLines,
        });
        get().pushToast('error', '代码存在错误，无法同步到表单');
        return false;
      }
      const name = parsed.programName?.trim() || project.name;
      const nextProject: Project = { ...project, name, rules: parsed.rules, updatedAt: Date.now() };
      set({
        projects: state.projects.map((p) => (p.id === nextProject.id ? nextProject : p)),
        diagnostics: parsed.diagnostics,
        parseFailed: false,
        lineToRule: parsed.lineToRule,
        ruleLines: parsed.ruleLines,
        codeSource: 'code',
        past: [...state.past, historyOf(project)].slice(-MAX_HISTORY),
        future: [],
      });
      get().pushToast('success', '代码已同步到表单');
      return true;
    },

    recomputeDiagnostics() {
      const state = get();
      const project = active();
      if (!project) return;
      const { diagnostics, parseFailed, lineToRule, ruleLines } = computeDiagnostics(
        state.code,
        project,
        state.settings.locale,
      );
      set({ diagnostics, parseFailed, lineToRule, ruleLines });
    },

    applyTagFixes() {
      const state = get();
      const project = active();
      if (!project) return 0;
      const names = new Set<string>();
      for (const diagnostic of state.diagnostics) {
        if (diagnostic.fix?.kind === 'define-tag' && diagnostic.fix.tagName) names.add(diagnostic.fix.tagName);
      }
      if (!names.size) return 0;
      const existing = new Set(project.tags.map((t) => t.name));
      const created: Tag[] = [];
      for (const name of names) {
        if (existing.has(name)) continue;
        existing.add(name);
        created.push({
          id: newId('tag'),
          name,
          color: ACCENTS[(project.tags.length + created.length) % ACCENTS.length]?.color ?? '#34d399',
          note: '由一键修复创建',
        });
      }
      if (!created.length) {
        get().recomputeDiagnostics();
        return 0;
      }
      patchProject({ tags: [...project.tags, ...created] });
      get().pushToast('success', `已自动创建 ${created.length} 个标签`);
      return created.length;
    },

    replaceAll(mode, from, to) {
      const state = get();
      const project = active();
      if (!project) return 0;
      const source = from.trim();
      const target = to.trim();
      if (!source || source === target) return 0;
      if (mode === 'tag' && project.tags.some((tag) => tag.name === target)) {
        get().pushToast('warning', `标签「${target}」已存在，请换一个名字`);
        return 0;
      }
      if (mode === 'item' && !/^[a-z0-9_]+:{1,2}[a-z0-9_:]*$/.test(target)) {
        get().pushToast('warning', '物品 ID 需形如 minecraft:iron_ingot');
        return 0;
      }
      const { rules, count } = replaceInRules(project.rules, mode, source, target);
      if (count === 0) return 0;
      const tags =
        mode === 'tag'
          ? project.tags.map((tag) => (tag.name === source ? { ...tag, name: target } : tag))
          : project.tags;
      const items =
        mode === 'item'
          ? project.items.map((item) => (item.id === source ? { ...item, id: target } : item))
          : project.items;
      const nextProject: Project = { ...project, rules, tags, items, updatedAt: Date.now() };
      const code = serializeProgram(nextProject.name, nextProject.rules);
      const { diagnostics, parseFailed, lineToRule, ruleLines } = computeDiagnostics(
        code,
        nextProject,
        state.settings.locale,
      );
      set({
        projects: state.projects.map((p) => (p.id === nextProject.id ? nextProject : p)),
        code,
        diagnostics,
        parseFailed,
        lineToRule,
        ruleLines,
        codeSource: 'form',
        past: [...state.past, historyOf(project)].slice(-MAX_HISTORY),
        future: [],
      });
      return count;
    },

    undo() {
      const state = get();
      const project = active();
      if (!project || !state.past.length) return;
      const entry = state.past[state.past.length - 1];
      const nextProject: Project = {
        ...project,
        name: entry.name,
        rules: entry.rules,
        ...(entry.tags ? { tags: entry.tags } : {}),
        ...(entry.items ? { items: entry.items } : {}),
        updatedAt: Date.now(),
      };
      const code = serializeProgram(nextProject.name, nextProject.rules);
      const { diagnostics, parseFailed, lineToRule, ruleLines } = computeDiagnostics(
        code,
        nextProject,
        state.settings.locale,
      );
      set({
        past: state.past.slice(0, -1),
        future: [historyOf(project), ...state.future].slice(0, MAX_HISTORY),
        projects: state.projects.map((p) => (p.id === nextProject.id ? nextProject : p)),
        code,
        diagnostics,
        parseFailed,
        lineToRule,
        ruleLines,
        codeSource: 'form',
      });
    },

    redo() {
      const state = get();
      const project = active();
      if (!project || !state.future.length) return;
      const entry = state.future[0];
      const nextProject: Project = {
        ...project,
        name: entry.name,
        rules: entry.rules,
        ...(entry.tags ? { tags: entry.tags } : {}),
        ...(entry.items ? { items: entry.items } : {}),
        updatedAt: Date.now(),
      };
      const code = serializeProgram(nextProject.name, nextProject.rules);
      const { diagnostics, parseFailed, lineToRule, ruleLines } = computeDiagnostics(
        code,
        nextProject,
        state.settings.locale,
      );
      set({
        future: state.future.slice(1),
        past: [...state.past, historyOf(project)].slice(-MAX_HISTORY),
        projects: state.projects.map((p) => (p.id === nextProject.id ? nextProject : p)),
        code,
        diagnostics,
        parseFailed,
        lineToRule,
        ruleLines,
        codeSource: 'form',
      });
    },

    saveSnapshot(name) {
      const state = get();
      const project = active();
      if (!project) return;
      const snapshot: Snapshot = {
        id: newId('snap'),
        name: name?.trim() || `快照 ${project.snapshots.length + 1}`,
        timestamp: Date.now(),
        rules: project.rules,
        code: state.code,
      };
      patchProject({ snapshots: [snapshot, ...project.snapshots].slice(0, MAX_SNAPSHOTS) }, false);
      get().pushToast('success', `已保存快照「${snapshot.name}」`);
    },

    restoreSnapshot(snapshotId) {
      const project = active();
      if (!project) return;
      const snapshot = project.snapshots.find((s) => s.id === snapshotId);
      if (!snapshot) return;
      commitRules(snapshot.rules);
      get().pushToast('success', `已回滚到「${snapshot.name}」`);
    },

    deleteSnapshot(snapshotId) {
      const project = active();
      if (!project) return;
      patchProject({ snapshots: project.snapshots.filter((s) => s.id !== snapshotId) }, false);
    },

    addTag(name, color, note) {
      const state = get();
      const project = active();
      if (!project) return false;
      const trimmed = name.trim();
      if (!trimmed) return false;
      if (project.tags.some((t) => t.name === trimmed)) {
        get().pushToast('warning', `标签「${trimmed}」已存在`);
        return false;
      }
      const tag: Tag = {
        id: newId('tag'),
        name: trimmed,
        color: color ?? ACCENTS[project.tags.length % ACCENTS.length]?.color ?? '#34d399',
        note: note ?? '',
      };
      patchProject({ tags: [...project.tags, tag] });
      return true;
    },

    updateTag(id, patch) {
      const state = get();
      const project = active();
      if (!project) return false;
      const target = project.tags.find((t) => t.id === id);
      if (!target) return false;
      const nextName = patch.name !== undefined ? patch.name.trim() : target.name;
      if (!nextName) return false;
      if (project.tags.some((t) => t.id !== id && t.name === nextName)) {
        get().pushToast('warning', `标签「${nextName}」已存在`);
        return false;
      }
      patchProject({ tags: project.tags.map((t) => (t.id === id ? { ...t, ...patch, name: nextName } : t)) });
      return true;
    },

    removeTag(id) {
      const project = active();
      if (!project) return;
      patchProject({ tags: project.tags.filter((t) => t.id !== id) });
    },

    addItem(item) {
      const project = active();
      if (!project) return false;
      const id = item.id.trim();
      if (!id) return false;
      if (project.items.some((i) => i.id === id)) {
        get().pushToast('warning', `物品「${id}」已存在`);
        return false;
      }
      const next: Item = {
        id,
        name: item.name.trim() || id,
        category: (item.category ?? 'misc') as ItemCategory,
        icon: item.icon || '🧱',
        custom: true,
      };
      patchProject({ items: [...project.items, next] }, false);
      return true;
    },

    updateItem(id, patch) {
      const project = active();
      if (!project) return;
      patchProject({
        items: project.items.map((item) => (item.id === id ? { ...item, ...patch, id: item.id } : item)),
      }, false);
    },

    removeItem(id) {
      const project = active();
      if (!project) return;
      patchProject({ items: project.items.filter((item) => item.id !== id) }, false);
    },

    saveRulesAsTemplate(ruleIds, name, description = '') {
      const state = get();
      const project = active();
      if (!project) return false;
      const trimmed = name.trim();
      if (!trimmed) return false;
      const picked = ruleIds
        .map((id) => findRule(project.rules, id))
        .filter((rule): rule is Rule => Boolean(rule))
        .map(cloneRuleDeep);
      if (!picked.length) {
        get().pushToast('warning', '请先选择要保存的规则');
        return false;
      }
      const template: Template = {
        id: newId('tpl'),
        name: trimmed,
        description: description.trim(),
        rules: picked,
        createdAt: Date.now(),
      };
      set({ templates: [...state.templates, template] });
      get().pushToast('success', `模板「${trimmed}」已保存`);
      return true;
    },

    insertTemplate(templateId, parentId, bodyKey = 'body') {
      const state = get();
      const project = active();
      if (!project) return;
      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return;
      const clones = template.rules.map(cloneRuleDeep);
      let next = project.rules;
      for (const rule of clones) {
        next = parentId ? appendToBody(next, parentId, bodyKey, rule) : [...next, rule];
      }
      commitRules(next, { selectRuleId: clones[clones.length - 1]?.id ?? null });
      get().pushToast('success', `已插入模板「${template.name}」`);
    },

    deleteTemplate(templateId) {
      set({ templates: get().templates.filter((t) => t.id !== templateId) });
    },

    importTemplateText(text) {
      const parsed = parseProjectImport(text);
      if (!parsed) return false;
      if (parsed.templates.length) {
        set({ templates: [...get().templates, ...parsed.templates] });
      }
      if (parsed.projects.length) {
        for (const project of parsed.projects) {
          const template: Template = {
            id: newId('tpl'),
            name: project.name,
            description: '从 .sfm 项目导入',
            rules: project.rules,
            createdAt: Date.now(),
          };
          set({ templates: [...get().templates, template] });
        }
      }
      get().pushToast('success', '模板导入成功');
      return true;
    },

    updateSettings(patch) {
      const state = get();
      const nextSettings: Settings = {
        ...state.settings,
        ...patch,
        ai: { ...state.settings.ai, ...(patch.ai ?? {}) },
      };
      const project = active();
      if (!project) {
        set({ settings: nextSettings });
        return;
      }
      const { diagnostics, parseFailed, lineToRule, ruleLines } = computeDiagnostics(
        state.code,
        project,
        nextSettings.locale,
      );
      set({ settings: nextSettings, diagnostics, parseFailed, lineToRule, ruleLines });
    },

    updateAi(patch) {
      const state = get();
      set({ settings: { ...state.settings, ai: { ...state.settings.ai, ...patch } } });
    },

    setLocale(locale) {
      get().updateSettings({ locale });
    },

    setTheme(patch) {
      const theme = { ...get().theme, ...patch };
      applyTheme(theme);
      set({ theme });
    },

    setBreakpoints(lines) {
      set({ breakpoints: [...new Set(lines)].sort((a, b) => a - b) });
    },

    setSidebarTab(tab) {
      set({ sidebarTab: tab, sidebarCollapsed: false });
    },

    toggleSidebar() {
      set({ sidebarCollapsed: !get().sidebarCollapsed });
    },

    pushToast(kind, message) {
      const id = newId('toast');
      set({ toasts: [...get().toasts, { id, kind, message }].slice(-MAX_TOASTS) });
      globalThis.setTimeout(() => get().dismissToast(id), 3600);
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },

    exportSfm() {
      const state = get();
      const project = active();
      if (!project) return;
      downloadText(`${safeFileName(project.name)}.sfm`, state.code);
      get().pushToast('success', '已导出 .sfm 文件');
    },

    async shareProject() {
      const project = active();
      if (!project) return;
      const token = encodeShare(project.name, project.rules, project.tags);
      const url = buildShareUrl(window.location.href, token);
      const copied = await copyText(url);
      window.history.replaceState(null, '', `#share=${token}`);
      get().pushToast(
        copied ? 'success' : 'warning',
        copied ? `分享链接已复制（${token.length} 字符）` : '链接已生成，但复制失败，请手动复制地址栏',
      );
    },

    async copyGiveCommand() {
      const command = buildGiveCommand(get().code);
      const copied = await copyText(command);
      get().pushToast(
        copied ? 'success' : 'warning',
        copied ? `/give 指令已复制（${command.length} 字符）` : '/give 指令已生成，但复制失败',
      );
    },

    importSharedProject(payload) {
      const state = get();
      const base = createDefaultProject(payload.name);
      const project: Project = {
        ...base,
        id: newId('proj'),
        name: payload.name || '分享的项目',
        rules: payload.rules,
        tags: payload.tags.length ? payload.tags : base.tags,
        snapshots: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      replaceProjects([...state.projects, project], project.id);
      get().pushToast('success', `已导入分享项目「${project.name}」`);
    },

    exportProjectJson() {
      const project = active();
      if (!project) return;
      downloadText(
        `${safeFileName(project.name)}.json`,
        JSON.stringify({ ...project, exportedAt: Date.now() }, null, 2),
      );
      get().pushToast('success', '已导出项目 JSON');
    },

    exportBackup() {
      const state = get();
      const bundle = buildBackup({
        projects: state.projects,
        templates: state.templates,
        theme: state.theme,
        settings: state.settings,
      });
      downloadText('sfm-studio-backup.json', JSON.stringify(bundle, null, 2));
      get().pushToast('success', '已导出完整备份');
    },

    importBackup(text) {
      const parsed = parseBackup(text);
      if (!parsed) {
        get().pushToast('error', '备份文件无效');
        return false;
      }
      applyTheme(parsed.theme);
      replaceProjects(parsed.projects, parsed.projects[0].id);
      set({
        templates: parsed.templates.length ? parsed.templates : get().templates,
        theme: parsed.theme,
        settings: parsed.settings,
      });
      get().recomputeDiagnostics();
      get().pushToast('success', `已恢复 ${parsed.projects.length} 个项目`);
      return true;
    },

    importProjectText(text) {
      /* 去掉 Windows 记事本可能写入的 BOM，否则 JSON / 脚本首行会解析失败 */
      const trimmed = text.replace(/^\uFEFF/, '').trim();
      if (!trimmed) {
        get().pushToast('error', '文件内容是空的');
        return false;
      }
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = parseProjectImport(trimmed);
        if (parsed) {
          const state = get();
          if (parsed.projects.length) {
            const projects = [...state.projects, ...parsed.projects];
            set({ projects });
            get().setActiveProject(parsed.projects[0].id);
          }
          if (parsed.templates.length) set({ templates: [...state.templates, ...parsed.templates] });
          get().pushToast('success', '项目导入成功');
          return true;
        }
        get().pushToast('error', 'JSON 结构无法识别，缺少 name / rules 字段');
        return false;
      }

      /* 不是 JSON：按官方 SFM 脚本导入 */
      const state = get();
      const knownTags = Array.from(new Set(state.projects.flatMap((project) => project.tags.map((tag) => tag.name))));
      const parsed = parseProgram(trimmed, { knownTags, locale: state.settings.locale });
      const errors = parsed.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
      if (errors.length > 0) {
        get().pushToast('error', `脚本解析失败：${errors[0].message}`);
        return false;
      }
      if (parsed.rules.length === 0) {
        get().pushToast('error', '脚本里没有可导入的规则');
        return false;
      }
      const base = createDefaultProject(parsed.programName || '导入的脚本');
      const existing = new Set(base.tags.map((tag) => tag.name));
      for (const name of collectTags(parsed.rules)) {
        if (!name || name === '?' || existing.has(name)) continue;
        base.tags.push({ id: newId('tag'), name, color: '#38bdf8', note: '' });
        existing.add(name);
      }
      const project: Project = { ...base, rules: parsed.rules };
      replaceProjects([...state.projects, project], project.id);
      get().pushToast('success', `已导入脚本「${project.name}」`);
      return true;
    },

    applyAiRules(rules, mode, programName) {
      const project = active();
      if (!project) return;
      if (mode === 'replace') commitRules(rules, { name: programName });
      else commitRules([...project.rules, ...rules], { name: programName });
      get().pushToast('success', `AI 已生成 ${rules.length} 条规则`);
    },
  };
});

/** 启动持久化：读取 IndexedDB → 自动保存订阅 */
export async function startPersistence(): Promise<void> {
  await useStore.getState().hydrate();

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSave = '';
  const flush = (force = false) => {
    const state = useStore.getState();
    if (!state.hydrated) return;
    const snapshot = snapshotState(state);
    const serialized = JSON.stringify(snapshot);
    if (!force && serialized === lastSave) return;
    lastSave = serialized;
    void saveWorkspace(snapshot);
  };

  useStore.subscribe((state, prev) => {
    if (!state.hydrated) return;
    const changed =
      state.projects !== prev.projects ||
      state.activeProjectId !== prev.activeProjectId ||
      state.templates !== prev.templates ||
      state.theme !== prev.theme ||
      state.settings !== prev.settings ||
      state.sidebarTab !== prev.sidebarTab ||
      state.sidebarCollapsed !== prev.sidebarCollapsed;
    if (!changed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => flush(), 500);
  });

  window.addEventListener('beforeunload', () => flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
}

/** 供组件使用的选择器 */
export const useActiveProject = (): Project | undefined =>
  useStore((state) => state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0]);
