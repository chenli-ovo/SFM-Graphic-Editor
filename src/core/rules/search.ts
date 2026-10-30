/**
 * 规则搜索与批量替换（全局查找 / 标签重命名 / 物品 ID 批量修改）。
 *
 * 搜索：对每条规则"自身"的文本做匹配（摘要 + 备注 + elif 条件），
 * 容器规则若自身不匹配但子规则匹配，则只保留匹配的子树，
 * 这样列表过滤后仍能看到规则所在的 every / if 上下文。
 */
import type { BoolExpr, Rule } from '../types';
import { exprToText, summarizeRule } from '../parser/serialize';

export type ReplaceMode = 'tag' | 'item';

export interface ReplaceResult {
  rules: Rule[];
  count: number;
}

function selfText(rule: Rule): string {
  const parts = [summarizeRule(rule), rule.note];
  if (rule.type === 'if') {
    rule.elifs.forEach((clause) => parts.push(exprToText(clause.condition)));
  }
  return parts.join('\n').toLowerCase();
}

function ruleMatches(rule: Rule, needle: string): boolean {
  return selfText(rule).includes(needle);
}

function filterRules(rules: Rule[], needle: string): Rule[] {
  const out: Rule[] = [];
  for (const rule of rules) {
    if (ruleMatches(rule, needle)) {
      out.push(rule);
      continue;
    }
    if (rule.type === 'every' || rule.type === 'pulse') {
      const body = filterRules(rule.body, needle);
      if (body.length > 0) out.push({ ...rule, body });
      continue;
    }
    if (rule.type === 'if') {
      const then = filterRules(rule.then, needle);
      const elseBody = filterRules(rule.else, needle);
      const elifs = rule.elifs
        .map((clause) => ({ ...clause, body: filterRules(clause.body, needle) }))
        .filter((clause) => clause.body.length > 0);
      if (then.length > 0 || elseBody.length > 0 || elifs.length > 0) {
        out.push({ ...rule, then, elifs, else: elseBody });
      }
    }
  }
  return out;
}

/** 返回过滤后的规则树；query 为空时原样返回 */
export function searchRules(rules: Rule[], query: string): Rule[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rules;
  return filterRules(rules, needle);
}

/* ------------------------------------------------------------------ */
/* 批量替换                                                            */
/* ------------------------------------------------------------------ */

function replaceToken(value: string, from: string, to: string): string {
  return value === from ? to : value;
}

/** `stone or dirt` 这类多资源写法按段替换 */
function replaceResource(raw: string, from: string, to: string, state: { count: number }): string {
  const parts = raw.split(/\s+or\s+/);
  let changed = false;
  const next = parts.map((part) => {
    const trimmed = part.trim();
    if (trimmed === from) {
      changed = true;
      state.count += 1;
      return to;
    }
    return trimmed;
  });
  return changed ? next.join(' or ') : raw;
}

function replaceLabels(list: string[], from: string, to: string, state: { count: number }): string[] {
  return list.map((label) => {
    if (label !== from) return label;
    state.count += 1;
    return to;
  });
}

function replaceExpr(expr: BoolExpr, from: string, to: string, state: { count: number }): BoolExpr {
  switch (expr.kind) {
    case 'has':
      return {
        ...expr,
        labels: replaceLabels(expr.labels, from, to, state),
        resource: replaceResource(expr.resource, from, to, state),
      };
    case 'not':
      return { ...expr, expr: replaceExpr(expr.expr, from, to, state) };
    case 'and':
    case 'or':
      return {
        ...expr,
        left: replaceExpr(expr.left, from, to, state),
        right: replaceExpr(expr.right, from, to, state),
      };
    default:
      return expr;
  }
}

/**
 * 在整棵规则树里把 `from` 替换成 `to`。
 * - mode='tag'：规则标签、forget 标签、if / has 条件里的标签
 * - mode='item'：input/output 的资源、except，以及 has 条件里的资源 / except
 */
export function replaceInRules(rules: Rule[], mode: ReplaceMode, from: string, to: string): ReplaceResult {
  const state = { count: 0 };
  const cloned = structuredClone(rules) as Rule[];

  const visit = (list: Rule[]) => {
    for (const rule of list) {
      if (mode === 'tag') {
        if (rule.type === 'input' || rule.type === 'output' || rule.type === 'forget') {
          rule.labels = replaceLabels(rule.labels, from, to, state);
        }
        if (rule.type === 'if') {
          rule.condition = replaceExpr(rule.condition, from, to, state);
          rule.elifs = rule.elifs.map((clause) => ({
            ...clause,
            condition: replaceExpr(clause.condition, from, to, state),
          }));
        }
      } else if (rule.type === 'input' || rule.type === 'output') {
        rule.ops = rule.ops.map((op) => ({
          ...op,
          resource: replaceResource(op.resource, from, to, state),
        }));
        rule.except = replaceResourceList(rule.except, from, to, state);
      } else if (rule.type === 'if') {
        rule.condition = replaceExprItem(rule.condition, from, to, state);
        rule.elifs = rule.elifs.map((clause) => ({
          ...clause,
          condition: replaceExprItem(clause.condition, from, to, state),
        }));
      }

      if (rule.type === 'every' || rule.type === 'pulse') visit(rule.body);
      else if (rule.type === 'if') {
        visit(rule.then);
        rule.elifs.forEach((clause) => visit(clause.body));
        visit(rule.else);
      }
    }
  };

  visit(cloned);
  return { rules: cloned, count: state.count };
}

function replaceResourceList(list: string[], from: string, to: string, state: { count: number }): string[] {
  return list.map((entry) => replaceResource(entry, from, to, state));
}

function replaceExprItem(expr: BoolExpr, from: string, to: string, state: { count: number }): BoolExpr {
  switch (expr.kind) {
    case 'has':
      return {
        ...expr,
        resource: replaceResource(expr.resource, from, to, state),
        except: replaceResourceList(expr.except, from, to, state),
      };
    case 'not':
      return { ...expr, expr: replaceExprItem(expr.expr, from, to, state) };
    case 'and':
    case 'or':
      return {
        ...expr,
        left: replaceExprItem(expr.left, from, to, state),
        right: replaceExprItem(expr.right, from, to, state),
      };
    default:
      return expr;
  }
}
