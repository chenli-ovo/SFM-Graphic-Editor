/**
 * SFM Studio — 全局领域类型
 *
 * 规则模型严格对齐官方 Super Factory Manager 语法（4.20+ / 4.27）：
 *   name ".." ；every [n] [g] [+] ticks|seconds do .. end ；every redstone pulse do .. end
 *   input/output [count each] [retain n each] [resource] .. from|to [empty slots in] [each] <label>*
 *     [round robin by label|block] [<side>* side] [slots <range>*]
 *   if <boolexpr> then .. else if .. else .. end ；forget [<label>*]
 *
 * 这里的类型同时被 parser / store / UI / AI / 模拟器复用。
 */

/* ------------------------------------------------------------------ */
/* 基础枚举                                                            */
/* ------------------------------------------------------------------ */

export const SIDES = ['top', 'bottom', 'north', 'south', 'east', 'west', 'left', 'right', 'front', 'back'] as const;
export type Side = (typeof SIDES)[number];

export const TIME_UNITS = ['ticks', 'seconds'] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

export const COMPARE_OPS = ['gt', 'lt', 'eq', 'le', 'ge'] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const SET_OPS = ['overall', 'every', 'each', 'some', 'one', 'lone'] as const;
export type SetOp = (typeof SET_OPS)[number];

export const RULE_TYPES = ['every', 'pulse', 'input', 'output', 'if', 'forget'] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export type Locale = 'zh' | 'en';
export type ThemeMode = 'dark' | 'light' | 'cyber';

/* ------------------------------------------------------------------ */
/* 通用语法片段                                                        */
/* ------------------------------------------------------------------ */

/** side 关键字：不指定 / 指定若干 / each */
export interface SideSpec {
  mode: 'none' | 'list' | 'each';
  sides: Side[];
}

export interface WithClause {
  /** 原样保留的子句内容，如 `tag #ores`、`(tag #logs and not tag #planks)` */
  raw: string;
}

/** input/output 语句前面的一个操作项：数量 / retain / resourceid / with / without */
export interface IoOp {
  /** 传输数量，null 表示不写 */
  count: number | null;
  /** 数量后是否带 each（每个物品类型都传输 count 个） */
  countEach: boolean;
  /** retain 保留数量 */
  retain: number | null;
  retainEach: boolean;
  /** resourceid 原文，如 `minecraft:iron_ingot`、`*_ingot`、`fe::`、`"stone or dirt"` */
  resource: string;
  withClause: string | null;
  withoutClause: string | null;
}

export interface ElseIfClause {
  /** 分支自身 id，便于在树中定位 / 拖拽排序 */
  id: string;
  condition: BoolExpr;
  body: Rule[];
}

/* ------------------------------------------------------------------ */
/* 条件表达式 (if boolexpr)                                            */
/* ------------------------------------------------------------------ */

export interface HasExpr {
  kind: 'has';
  setOp: SetOp;
  labels: string[];
  each: boolean;
  roundRobin: 'label' | 'block' | null;
  sides: SideSpec;
  slots: string;
  op: CompareOp;
  /** null 表示尚未填写数量 */
  value: number | null;
  resource: string;
  withClause: string | null;
  withoutClause: string | null;
  except: string[];
}

export interface RedstoneExpr {
  kind: 'redstone';
  /** null 表示 `if redstone`（仅判断是否有信号） */
  op: CompareOp | null;
  value: number | null;
}

export type BoolExpr =
  | { kind: 'const'; value: boolean }
  | { kind: 'not'; expr: BoolExpr }
  | { kind: 'and'; left: BoolExpr; right: BoolExpr }
  | { kind: 'or'; left: BoolExpr; right: BoolExpr }
  | HasExpr
  | RedstoneExpr;

/* ------------------------------------------------------------------ */
/* 规则 AST                                                            */
/* ------------------------------------------------------------------ */

export interface RuleBase {
  id: string;
  collapsed: boolean;
  /** 卡片备注，以 `--` 注释写入代码 */
  note: string;
}

export interface EveryRule extends RuleBase {
  type: 'every';
  /** 执行间隔；null 表示表单未填 → 占位符 */
  interval: number | null;
  /** 全局 tick 对齐（global / g） */
  global: boolean;
  /** 相位偏移（+ offset） */
  offset: number | null;
  unit: TimeUnit;
  body: Rule[];
}

export interface PulseRule extends RuleBase {
  type: 'pulse';
  body: Rule[];
}

export interface InputRule extends RuleBase {
  type: 'input';
  ops: IoOp[];
  except: string[];
  labels: string[];
  each: boolean;
  roundRobin: 'label' | 'block' | null;
  sides: SideSpec;
  /** 槽位原文：`0-5, 8` */
  slots: string;
}

export interface OutputRule extends RuleBase {
  type: 'output';
  ops: IoOp[];
  except: string[];
  labels: string[];
  each: boolean;
  roundRobin: 'label' | 'block' | null;
  sides: SideSpec;
  slots: string;
  /** output to empty slots in <label> */
  emptySlotsIn: boolean;
}

export interface IfRule extends RuleBase {
  type: 'if';
  condition: BoolExpr;
  then: Rule[];
  elifs: ElseIfClause[];
  else: Rule[];
}

export interface ForgetRule extends RuleBase {
  type: 'forget';
  labels: string[];
}

export type Rule = EveryRule | PulseRule | InputRule | OutputRule | IfRule | ForgetRule;

export type RuleWithBody = EveryRule | PulseRule | IfRule;

export function ruleHasBody(rule: Rule): rule is RuleWithBody {
  return rule.type === 'every' || rule.type === 'pulse' || rule.type === 'if';
}

/* ------------------------------------------------------------------ */
/* 诊断                                                               */
/* ------------------------------------------------------------------ */

export type Severity = 'error' | 'warning' | 'info';

export interface QuickFix {
  kind: 'define-tag';
  tagName: string;
}

export interface Diagnostic {
  severity: Severity;
  message: string;
  /** 文档字符偏移 */
  from: number;
  to: number;
  /** 1-based 行号 */
  line: number;
  fix?: QuickFix;
}

/* ------------------------------------------------------------------ */
/* 数据实体                                                            */
/* ------------------------------------------------------------------ */

export interface Tag {
  id: string;
  name: string;
  color: string;
  note: string;
}

export type ItemCategory = 'ore' | 'ingot' | 'gem' | 'dust' | 'food' | 'redstone' | 'machine' | 'storage' | 'misc';

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  icon: string;
  custom: boolean;
}

export interface Snapshot {
  id: string;
  name: string;
  timestamp: number;
  rules: Rule[];
  code: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  rules: Rule[];
  createdAt: number;
  builtin?: boolean;
}

export interface Project {
  id: string;
  name: string;
  rules: Rule[];
  tags: Tag[];
  items: Item[];
  snapshots: Snapshot[];
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* 设置 / 主题                                                         */
/* ------------------------------------------------------------------ */

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface Settings {
  locale: Locale;
  sound: boolean;
  showMinimap: boolean;
  ai: AiSettings;
}

export interface ThemeState {
  mode: ThemeMode;
  accent: string;
  customAccent: string;
}

export interface AccentPreset {
  id: string;
  label: string;
  labelEn: string;
  color: string;
}

/* ------------------------------------------------------------------ */
/* 拓扑 / 分析 / 模拟                                                  */
/* ------------------------------------------------------------------ */

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  /** 该连线来自哪条规则 */
  ruleId: string;
  ruleType: RuleType;
}

export interface FlowNode {
  id: string;
  label: string;
  kind: 'label' | 'side';
  color: string;
}

export interface TopologyData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface DeadlockWarning {
  kind: 'cycle' | 'unbalanced' | 'busy';
  message: string;
  ruleIds: string[];
}

export interface PerfReport {
  score: number;
  peakTps: number;
  ticksPerSecond: number;
  totalRules: number;
  everyTickRules: number;
  warnings: string[];
  metrics: { label: string; value: number }[];
}

export interface SimEvent {
  tick: number;
  line: number;
  ruleId: string | null;
  kind: 'input' | 'output' | 'if' | 'pulse' | 'every' | 'info' | 'error';
  message: string;
  /** 该事件模拟的传输数量 */
  amount?: number;
}

export interface SimulationResult {
  events: SimEvent[];
  totalTicks: number;
  inputs: number;
  outputs: number;
  warnings: string[];
}
