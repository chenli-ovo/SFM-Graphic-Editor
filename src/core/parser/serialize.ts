import {
  type BoolExpr,
  type CompareOp,
  type EveryRule,
  type ForgetRule,
  type IfRule,
  type InputRule,
  type IoOp,
  type OutputRule,
  type Rule,
  type SideSpec,
  type SIDES,
  ruleHasBody,
} from '../types';

/* ------------------------------------------------------------------ */
/* 基础 token → 文本                                                   */
/* ------------------------------------------------------------------ */

const KEYWORDS = new Set([
  'name',
  'every',
  'redstone',
  'pulse',
  'do',
  'end',
  'if',
  'then',
  'else',
  'input',
  'output',
  'from',
  'to',
  'each',
  'retain',
  'except',
  'with',
  'without',
  'tag',
  'and',
  'or',
  'not',
  'has',
  'slots',
  'slot',
  'empty',
  'in',
  'round',
  'robin',
  'by',
  'label',
  'block',
  'forget',
  'true',
  'false',
  'global',
  'ticks',
  'tick',
  'seconds',
  'second',
]);

export function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** 标签在代码中的写法：安全标识符直接写，否则加引号 */
export function labelToText(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '"?"';
  if (/^[A-Za-z0-9_]+$/.test(trimmed) && !KEYWORDS.has(trimmed.toLowerCase())) return trimmed;
  return `"${escapeString(trimmed)}"`;
}

export function labelsToText(labels: string[]): string {
  if (labels.length === 0) return labelToText('');
  return labels.map(labelToText).join(', ');
}

export function sideSpecToText(spec: SideSpec): string {
  if (spec.mode === 'each') return 'each side';
  if (spec.mode === 'list' && spec.sides.length > 0) return `${spec.sides.join(', ')} side`;
  return '';
}

function slotText(slots: string, keyword = 'slots'): string {
  const trimmed = slots.trim();
  if (!trimmed) return '';
  return `${keyword} ${trimmed}`;
}

const COMPARE_TEXT: Record<CompareOp, string> = {
  gt: '>',
  lt: '<',
  eq: '=',
  le: '<=',
  ge: '>=',
};

export function compareToText(op: CompareOp): string {
  return COMPARE_TEXT[op];
}

function clauseText(keyword: 'with' | 'without', raw: string | null): string {
  const trimmed = (raw ?? '').trim();
  return trimmed ? ` ${keyword} ${trimmed}` : '';
}

export function ioOpToText(op: IoOp): string {
  const parts: string[] = [];
  if (op.count !== null) parts.push(`${op.count}${op.countEach ? ' each' : ''}`);
  if (op.retain !== null) parts.push(`retain ${op.retain}${op.retainEach ? ' each' : ''}`);
  if (op.resource.trim()) parts.push(op.resource.trim());
  const text = parts.join(' ') + clauseText('with', op.withClause) + clauseText('without', op.withoutClause);
  return text.trim();
}

export function opsToText(ops: IoOp[]): string {
  return ops
    .map(ioOpToText)
    .filter(Boolean)
    .join(' ');
}

export function exceptToText(except: string[]): string {
  const items = except.map((entry) => entry.trim()).filter(Boolean);
  if (items.length === 0) return '';
  return `except ${items.join(',')}`;
}

/** 输入 / 输出语句主体（不含缩进） */
export function ioRuleBody(rule: InputRule | OutputRule): string {
  const isOutput = rule.type === 'output';
  const parts: string[] = [rule.type];

  const ops = opsToText(rule.ops);
  if (ops) parts.push(ops);

  const except = exceptToText(rule.except);
  if (except) parts.push(except);

  parts.push(isOutput ? 'to' : 'from');

  if (isOutput && (rule as OutputRule).emptySlotsIn) parts.push('empty slots in');

  if (rule.each) parts.push('each');

  parts.push(labelsToText(rule.labels));

  if (rule.roundRobin) parts.push(`round robin by ${rule.roundRobin}`);

  const sides = sideSpecToText(rule.sides);
  if (sides) parts.push(sides);

  const slots = slotText(rule.slots);
  if (slots) parts.push(slots);

  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/* 条件表达式                                                          */
/* ------------------------------------------------------------------ */

export function exprToText(expr: BoolExpr, parent: 'none' | 'and' | 'or' | 'not' = 'none'): string {
  switch (expr.kind) {
    case 'const':
      return expr.value ? 'true' : 'false';
    case 'not':
      return `not ${exprToText(expr.expr, 'not')}`;
    case 'and':
    case 'or': {
      const text = `${exprToText(expr.left, expr.kind)} ${expr.kind} ${exprToText(expr.right, expr.kind)}`;
      const needParens =
        (expr.kind === 'or' && parent === 'and') ||
        (expr.kind === 'and' && parent === 'or') ||
        parent === 'not';
      return needParens ? `(${text})` : text;
    }
    case 'has': {
      const parts: string[] = [];
      if (expr.setOp !== 'overall') parts.push(expr.setOp);
      if (expr.each) parts.push('each');
      parts.push(labelsToText(expr.labels));
      if (expr.roundRobin) parts.push(`round robin by ${expr.roundRobin}`);
      const sides = sideSpecToText(expr.sides);
      if (sides) parts.push(sides);
      const slots = slotText(expr.slots);
      if (slots) parts.push(slots);
      parts.push('has');
      parts.push(compareToText(expr.op));
      parts.push(expr.value === null ? '?' : String(expr.value));
      if (expr.resource.trim()) parts.push(expr.resource.trim());
      const withText = clauseText('with', expr.withClause);
      if (withText) parts.push(withText.trim());
      const withoutText = clauseText('without', expr.withoutClause);
      if (withoutText) parts.push(withoutText.trim());
      const except = exceptToText(expr.except);
      if (except) parts.push(except);
      return parts.join(' ');
    }
    case 'redstone': {
      if (expr.op === null || expr.value === null) return 'redstone';
      return `redstone ${compareToText(expr.op)} ${expr.value}`;
    }
    default:
      return 'true';
  }
}

/** 供卡片摘要使用的一行概述 */
export function summarizeRule(rule: Rule): string {
  switch (rule.type) {
    case 'every':
      return `every ${rule.interval ?? '?'}${rule.global ? ' g' : ''}${
        rule.offset !== null ? ` + ${rule.offset}` : ''
      } ${rule.unit}`;
    case 'pulse':
      return 'every redstone pulse';
    case 'input':
    case 'output':
      return ioRuleBody(rule);
    case 'if':
      return `if ${exprToText(rule.condition)}`;
    case 'forget':
      return `forget ${labelsToText(rule.labels)}`.trim();
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ */
/* 单条规则序列化                                                       */
/* ------------------------------------------------------------------ */

function indentOf(depth: number): string {
  return '  '.repeat(depth);
}

function noteLines(rule: Rule, depth: number): string[] {
  const note = rule.note.trim();
  if (!note) return [];
  return note
    .split(/\r?\n/)
    .map((line) => `${indentOf(depth)}-- ${line}`);
}

export function serializeRule(rule: Rule, depth = 0): string[] {
  const pad = indentOf(depth);
  const out: string[] = [...noteLines(rule, depth)];

  switch (rule.type) {
    case 'every': {
      const every = rule as EveryRule;
      const interval = every.interval ?? '?';
      const global = every.global ? ' g' : '';
      const offset = every.offset !== null ? ` + ${every.offset}` : '';
      out.push(`${pad}every ${interval}${global}${offset} ${every.unit} do`);
      out.push(...serializeList(every.body, depth + 1));
      out.push(`${pad}end`);
      break;
    }
    case 'pulse': {
      out.push(`${pad}every redstone pulse do`);
      out.push(...serializeList(rule.body, depth + 1));
      out.push(`${pad}end`);
      break;
    }
    case 'input':
    case 'output': {
      out.push(`${pad}${ioRuleBody(rule)}`);
      break;
    }
    case 'if': {
      const ifRule = rule as IfRule;
      out.push(`${pad}if ${exprToText(ifRule.condition)} then`);
      out.push(...serializeList(ifRule.then, depth + 1));
      for (const clause of ifRule.elifs) {
        out.push(`${pad}else if ${exprToText(clause.condition)} then`);
        out.push(...serializeList(clause.body, depth + 1));
      }
      if (ifRule.else.length > 0) {
        out.push(`${pad}else`);
        out.push(...serializeList(ifRule.else, depth + 1));
      }
      out.push(`${pad}end`);
      break;
    }
    case 'forget': {
      const forget = rule as ForgetRule;
      const labels = labelsToText(forget.labels);
      out.push(labels ? `${pad}forget ${labels}` : `${pad}forget`);
      break;
    }
    default:
      break;
  }
  return out;
}

export function serializeList(rules: Rule[], depth = 0): string[] {
  const chunks = rules.map((rule) => serializeRule(rule, depth));
  if (depth > 0) return chunks.flat();
  return chunks.flatMap((chunk, index) => (index === 0 ? chunk : ['', ...chunk]));
}

/** 序列化单个规则片段（复制规则 / 导出模板用） */
export function serializeRuleSnippet(rule: Rule): string {
  return serializeRule(rule, 0).join('\n');
}

/* ------------------------------------------------------------------ */
/* 整个程序                                                            */
/* ------------------------------------------------------------------ */

export interface SerializeOptions {
  includeName?: boolean;
  includeHeader?: boolean;
}

export function serializeProgram(programName: string, rules: Rule[], options: SerializeOptions = {}): string {
  const { includeName = true, includeHeader = true } = options;
  const lines: string[] = [];

  if (includeName) {
    lines.push(`name "${escapeString(programName)}"`);
    lines.push('');
  }
  if (includeHeader) {
    lines.push('-- Generated by SFM Studio — visual SFM script builder');
    lines.push('-- Docs: https://github.com/TeamDman/SuperFactoryManager');
    lines.push('');
  }

  if (rules.length === 0) {
    if (includeName) {
      lines.push('-- 还没有规则。在左侧点击「添加规则」开始构建你的工厂。');
      lines.push('-- No rules yet. Add one from the left panel to start building.');
    }
    return lines.join('\n').trimEnd() + '\n';
  }

  lines.push(...serializeList(rules, 0));
  const text = lines.join('\n');
  return text.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
