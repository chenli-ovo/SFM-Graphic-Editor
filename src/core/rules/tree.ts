import {
  type BoolExpr,
  type ElseIfClause,
  type EveryRule,
  type HasExpr,
  type IfRule,
  type InputRule,
  type IoOp,
  type OutputRule,
  type PulseRule,
  type Rule,
  type RuleType,
  type SideSpec,
  type Tag,
  ruleHasBody,
} from '../types';
import { newId } from '../../lib/id';

export type BodyKey = 'body' | 'then' | 'else' | 'elif';

/* ------------------------------------------------------------------ */
/* 工厂函数                                                            */
/* ------------------------------------------------------------------ */

export function emptySides(): SideSpec {
  return { mode: 'none', sides: [] };
}

export function defaultSides(): SideSpec {
  return { mode: 'list', sides: ['top'] };
}

export function emptyOp(): IoOp {
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

export function defaultHasExpr(): HasExpr {
  return {
    kind: 'has',
    setOp: 'overall',
    labels: [],
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
  };
}

export function createRule(type: RuleType): Rule {
  const base = { id: newId('rule'), collapsed: false, note: '' };
  switch (type) {
    case 'every':
      return {
        ...base,
        type: 'every',
        interval: 20,
        global: false,
        offset: null,
        unit: 'ticks',
        body: [],
      } satisfies EveryRule;
    case 'pulse':
      return { ...base, type: 'pulse', body: [] } satisfies PulseRule;
    case 'input':
      return {
        ...base,
        type: 'input',
        ops: [],
        except: [],
        labels: ['?'],
        each: false,
        roundRobin: null,
        sides: { mode: 'none', sides: [] },
        slots: '',
      } satisfies InputRule;
    case 'output':
      return {
        ...base,
        type: 'output',
        ops: [],
        except: [],
        labels: ['?'],
        each: false,
        roundRobin: null,
        sides: { mode: 'none', sides: [] },
        slots: '',
        emptySlotsIn: false,
      } satisfies OutputRule;
    case 'if':
      return {
        ...base,
        type: 'if',
        condition: defaultHasExpr(),
        then: [],
        elifs: [],
        else: [],
      } satisfies IfRule;
    case 'forget':
      return { ...base, type: 'forget', labels: [] };
    default:
      return { ...base, type: 'forget', labels: [] };
  }
}

/** 默认演示项目：展示全部 6 种规则 + 嵌套 */
export function createStarterRules(tags: Tag[] = []): Rule[] {
  const known = (name: string) => tags.some((tag) => tag.name === name);
  const label = (name: string) => (known(name) ? name : name);
  void label;
  return [
    {
      id: newId('rule'),
      type: 'every',
      interval: 20,
      global: false,
      offset: null,
      unit: 'ticks',
      collapsed: false,
      note: '每秒从矿石标签抽取物品送入顶部熔炉',
      body: [
        {
          id: newId('rule'),
          type: 'input',
          ops: [],
          except: [],
          labels: ['ores'],
          each: false,
          roundRobin: null,
          sides: { mode: 'none', sides: [] },
          slots: '0-5',
          collapsed: false,
          note: '',
        },
        {
          id: newId('rule'),
          type: 'output',
          ops: [{ ...emptyOp(), count: 8 }],
          except: [],
          labels: ['furnace'],
          each: false,
          roundRobin: null,
          sides: { mode: 'list', sides: ['top'] },
          slots: '',
          emptySlotsIn: false,
          collapsed: false,
          note: '',
        },
      ],
    },
    {
      id: newId('rule'),
      type: 'pulse',
      collapsed: false,
      note: '红石脉冲时输出到下方',
      body: [
        {
          id: newId('rule'),
          type: 'output',
          ops: [],
          except: [],
          labels: ['hopper'],
          each: false,
          roundRobin: null,
          sides: { mode: 'list', sides: ['bottom'] },
          slots: '',
          emptySlotsIn: false,
          collapsed: false,
          note: '',
        },
      ],
    },
    {
      id: newId('rule'),
      type: 'if',
      collapsed: false,
      note: '矿石超过 64 个时清空到仓库',
      condition: {
        ...defaultHasExpr(),
        labels: ['ores'],
        op: 'gt',
        value: 64,
      },
      then: [
        {
          id: newId('rule'),
          type: 'output',
          ops: [],
          except: [],
          labels: ['storage'],
          each: false,
          roundRobin: null,
          sides: { mode: 'none', sides: [] },
          slots: '',
          emptySlotsIn: false,
          collapsed: false,
          note: '',
        },
      ],
      elifs: [],
      else: [],
    },
    {
      id: newId('rule'),
      type: 'forget',
      collapsed: false,
      note: '清空输入缓存，避免重复传输',
      labels: ['ores'],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 遍历 / 查找                                                         */
/* ------------------------------------------------------------------ */

export interface WalkEntry {
  rule: Rule;
  depth: number;
  parentId: string | null;
  /** 该规则位于父规则的哪个 body 数组 */
  bodyKey: BodyKey | null;
  index: number;
}

export function walkRules(
  rules: Rule[],
  visit: (entry: WalkEntry) => void,
  depth = 0,
  parentId: string | null = null,
  bodyKey: BodyKey | null = null,
): void {
  rules.forEach((rule, index) => {
    visit({ rule, depth, parentId, bodyKey, index });
    if (rule.type === 'every' || rule.type === 'pulse') {
      walkRules(rule.body, visit, depth + 1, rule.id, 'body');
    } else if (rule.type === 'if') {
      walkRules(rule.then, visit, depth + 1, rule.id, 'then');
      for (const clause of rule.elifs) {
        walkRules(clause.body, visit, depth + 1, clause.id, 'elif');
      }
      walkRules(rule.else, visit, depth + 1, rule.id, 'else');
    }
  });
}

export function findRule(rules: Rule[], id: string): Rule | null {
  let found: Rule | null = null;
  walkRules(rules, ({ rule }) => {
    if (rule.id === id) found = rule;
  });
  return found;
}

/** 找到 elif 分支（id 为 ElseIfClause.id） */
export function findElif(rules: Rule[], clauseId: string): ElseIfClause | null {
  let found: ElseIfClause | null = null;
  walkRules(rules, ({ rule }) => {
    if (rule.type === 'if') {
      const clause = rule.elifs.find((entry) => entry.id === clauseId);
      if (clause) found = clause;
    }
  });
  return found;
}

export function countRules(rules: Rule[]): number {
  let n = 0;
  walkRules(rules, () => {
    n += 1;
  });
  return n;
}

/** 收集所有在标签列表 / has 条件里出现的标签 */
export function collectTags(rules: Rule[]): string[] {
  const out = new Set<string>();
  const visitExpr = (expr: BoolExpr) => {
    if (expr.kind === 'has') expr.labels.forEach((label) => out.add(label));
    if (expr.kind === 'not') visitExpr(expr.expr);
    if (expr.kind === 'and' || expr.kind === 'or') {
      visitExpr(expr.left);
      visitExpr(expr.right);
    }
  };
  walkRules(rules, ({ rule }) => {
    if (rule.type === 'input' || rule.type === 'output' || rule.type === 'forget') {
      rule.labels.forEach((label) => out.add(label));
    }
    if (rule.type === 'if') visitExpr(rule.condition);
  });
  out.delete('?');
  return [...out];
}

/** 收集所有资源标识（用于物品库联动） */
export function collectItems(rules: Rule[]): string[] {
  const out = new Set<string>();
  const visitExpr = (expr: BoolExpr) => {
    if (expr.kind === 'has' && expr.resource.trim()) out.add(expr.resource.trim());
    if (expr.kind === 'not') visitExpr(expr.expr);
    if (expr.kind === 'and' || expr.kind === 'or') {
      visitExpr(expr.left);
      visitExpr(expr.right);
    }
  };
  walkRules(rules, ({ rule }) => {
    if (rule.type === 'input' || rule.type === 'output') {
      rule.ops.forEach((op) => {
        if (op.resource.trim()) out.add(op.resource.trim());
      });
    }
    if (rule.type === 'if') visitExpr(rule.condition);
  });
  return [...out];
}

export function collectRuleIds(rules: Rule[]): string[] {
  const out: string[] = [];
  walkRules(rules, ({ rule }) => out.push(rule.id));
  return out;
}

/* ------------------------------------------------------------------ */
/* 不可变更新                                                          */
/* ------------------------------------------------------------------ */

export function cloneRuleDeep(rule: Rule): Rule {
  const copy = structuredClone(rule) as Rule;
  const assign = (r: Rule) => {
    r.id = newId('rule');
    if (ruleHasBody(r)) {
      if (r.type === 'if') {
        r.then.forEach(assign);
        r.elifs.forEach((clause) => {
          clause.id = newId('elif');
          clause.body.forEach(assign);
        });
        r.else.forEach(assign);
      } else {
        r.body.forEach(assign);
      }
    }
  };
  assign(copy);
  return copy;
}

export function updateRuleInTree(rules: Rule[], id: string, patch: Partial<Rule>): Rule[] {
  return rules.map((rule) => {
    if (rule.id === id) return { ...rule, ...patch } as Rule;
    if (rule.type === 'every' || rule.type === 'pulse') {
      return { ...rule, body: updateRuleInTree(rule.body, id, patch) } as Rule;
    }
    if (rule.type === 'if') {
      return {
        ...rule,
        then: updateRuleInTree(rule.then, id, patch),
        elifs: rule.elifs.map((clause) => ({ ...clause, body: updateRuleInTree(clause.body, id, patch) })),
        else: updateRuleInTree(rule.else, id, patch),
      } as Rule;
    }
    return rule;
  });
}

export function removeRuleInTree(rules: Rule[], id: string): Rule[] {
  const next: Rule[] = [];
  for (const rule of rules) {
    if (rule.id === id) continue;
    if (rule.type === 'every' || rule.type === 'pulse') {
      next.push({ ...rule, body: removeRuleInTree(rule.body, id) } as Rule);
    } else if (rule.type === 'if') {
      next.push({
        ...rule,
        then: removeRuleInTree(rule.then, id),
        elifs: rule.elifs.map((clause) => ({ ...clause, body: removeRuleInTree(clause.body, id) })),
        else: removeRuleInTree(rule.else, id),
      } as Rule);
    } else {
      next.push(rule);
    }
  }
  return next;
}

/** 追加到某个容器的末尾；parentId 可以是规则 id 或 elif 分支 id */
export function appendToBody(rules: Rule[], parentId: string, bodyKey: BodyKey, child: Rule): Rule[] {
  return rules.map((rule) => {
    if (rule.id === parentId) {
      if (rule.type === 'every' || rule.type === 'pulse') {
        if (bodyKey !== 'body') return rule;
        return { ...rule, body: [...rule.body, child] } as Rule;
      }
      if (rule.type === 'if') {
        if (bodyKey === 'then') return { ...rule, then: [...rule.then, child] } as Rule;
        if (bodyKey === 'else') return { ...rule, else: [...rule.else, child] } as Rule;
      }
      return rule;
    }
    if (rule.type === 'every' || rule.type === 'pulse') {
      return { ...rule, body: appendToBody(rule.body, parentId, bodyKey, child) } as Rule;
    }
    if (rule.type === 'if') {
      return {
        ...rule,
        then: appendToBody(rule.then, parentId, bodyKey, child),
        elifs: rule.elifs.map((clause) => {
          if (clause.id === parentId) {
            return { ...clause, body: [...clause.body, child] };
          }
          return { ...clause, body: appendToBody(clause.body, parentId, bodyKey, child) };
        }),
        else: appendToBody(rule.else, parentId, bodyKey, child),
      } as Rule;
    }
    return rule;
  });
}

export function insertAfterRule(rules: Rule[], targetId: string, inserted: Rule): Rule[] {
  const idx = rules.findIndex((r) => r.id === targetId);
  if (idx >= 0) {
    const next = [...rules];
    next.splice(idx + 1, 0, inserted);
    return next;
  }
  return rules.map((rule) => {
    if (rule.type === 'every' || rule.type === 'pulse') {
      return { ...rule, body: insertAfterRule(rule.body, targetId, inserted) } as Rule;
    }
    if (rule.type === 'if') {
      return {
        ...rule,
        then: insertAfterRule(rule.then, targetId, inserted),
        elifs: rule.elifs.map((clause) => ({ ...clause, body: insertAfterRule(clause.body, targetId, inserted) })),
        else: insertAfterRule(rule.else, targetId, inserted),
      } as Rule;
    }
    return rule;
  });
}

export function moveRuleInTree(rules: Rule[], id: string, dir: -1 | 1): Rule[] {
  const idx = rules.findIndex((r) => r.id === id);
  if (idx >= 0) {
    const target = idx + dir;
    if (target < 0 || target >= rules.length) return rules;
    const next = [...rules];
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    return next;
  }
  return rules.map((rule) => {
    if (rule.type === 'every' || rule.type === 'pulse') {
      return { ...rule, body: moveRuleInTree(rule.body, id, dir) } as Rule;
    }
    if (rule.type === 'if') {
      return {
        ...rule,
        then: moveRuleInTree(rule.then, id, dir),
        elifs: rule.elifs.map((clause) => ({ ...clause, body: moveRuleInTree(clause.body, id, dir) })),
        else: moveRuleInTree(rule.else, id, dir),
      } as Rule;
    }
    return rule;
  });
}

export function findSiblings(rules: Rule[], id: string): Rule[] | null {
  if (rules.some((r) => r.id === id)) return rules;
  for (const rule of rules) {
    if (rule.type === 'every' || rule.type === 'pulse') {
      const found = findSiblings(rule.body, id);
      if (found) return found;
    } else if (rule.type === 'if') {
      const inThen = findSiblings(rule.then, id);
      if (inThen) return inThen;
      for (const clause of rule.elifs) {
        const inElif = findSiblings(clause.body, id);
        if (inElif) return inElif;
      }
      const inElse = findSiblings(rule.else, id);
      if (inElse) return inElse;
    }
  }
  return null;
}

export function replaceSiblings(rules: Rule[], original: Rule[], sorted: Rule[]): Rule[] {
  if (rules === original) return sorted;
  return rules.map((rule) => {
    if (rule.type === 'every' || rule.type === 'pulse') {
      return { ...rule, body: replaceSiblings(rule.body, original, sorted) } as Rule;
    }
    if (rule.type === 'if') {
      return {
        ...rule,
        then: replaceSiblings(rule.then, original, sorted),
        elifs: rule.elifs.map((clause) => ({ ...clause, body: replaceSiblings(clause.body, original, sorted) })),
        else: replaceSiblings(rule.else, original, sorted),
      } as Rule;
    }
    return rule;
  });
}

export function indexRules(rules: Rule[]): Map<string, Rule> {
  const map = new Map<string, Rule>();
  walkRules(rules, ({ rule }) => map.set(rule.id, rule));
  return map;
}

export function isDescendant(rules: Rule[], ancestorId: string, candidateId: string): boolean {
  const ancestor = findRule(rules, ancestorId);
  if (!ancestor) return false;
  let found = false;
  const visit = (list: Rule[]) => {
    for (const r of list) {
      if (r.id === candidateId) found = true;
      if (r.type === 'every' || r.type === 'pulse') visit(r.body);
      else if (r.type === 'if') {
        visit(r.then);
        r.elifs.forEach((clause) => visit(clause.body));
        visit(r.else);
      }
    }
  };
  if (ancestor.type === 'every' || ancestor.type === 'pulse') visit(ancestor.body);
  else if (ancestor.type === 'if') {
    visit(ancestor.then);
    ancestor.elifs.forEach((clause) => visit(clause.body));
    visit(ancestor.else);
  }
  return found;
}
