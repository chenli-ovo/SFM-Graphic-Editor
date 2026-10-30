import { describe, expect, it } from 'vitest';
import { parseProgram } from '../core/parser';
import { createRule, defaultHasExpr } from '../core/rules/tree';
import { replaceInRules, searchRules } from '../core/rules/search';
import type { EveryRule, IfRule, InputRule, IoOp } from '../core/types';

function op(resource: string): IoOp {
  return { count: null, countEach: false, retain: null, retainEach: false, resource, withClause: null, withoutClause: null };
}

function inputOver(labels: string[], resource: string): InputRule {
  const rule = createRule('input') as InputRule;
  rule.labels = labels;
  rule.ops = [op(resource)];
  rule.sides = { mode: 'none', sides: [] };
  return rule;
}

function everyOf(body: InputRule[]): EveryRule {
  const every = createRule('every') as EveryRule;
  every.body = body;
  return every;
}

describe('searchRules', () => {
  it('匹配标签名并保留容器上下文', () => {
    const rules = [everyOf([inputOver(['ores'], 'minecraft:iron_ore')]), everyOf([inputOver(['fuel'], 'minecraft:coal')])];
    const filtered = searchRules(rules, 'ores');
    expect(filtered).toHaveLength(1);
    expect((filtered[0] as EveryRule).body).toHaveLength(1);
  });

  it('匹配物品 ID 与中文不会误伤', () => {
    const rules = [everyOf([inputOver(['ores'], 'minecraft:iron_ore')]), everyOf([inputOver(['fuel'], 'minecraft:coal')])];
    expect(searchRules(rules, 'iron_ore')).toHaveLength(1);
    expect(searchRules(rules, '不存在的东西')).toHaveLength(0);
    expect(searchRules(rules, '  ')).toBe(rules);
  });

  it('if 规则的 elif 条件也参与搜索', () => {
    const ifRule = createRule('if') as IfRule;
    ifRule.elifs = [{ id: 'elif-1', condition: ifRule.condition, body: [inputOver(['extra'], 'minecraft:stone')] }];
    ifRule.elifs[0].condition = { ...ifRule.condition } as IfRule['condition'];
    const rules = [ifRule];
    const filtered = searchRules(rules, 'extra');
    expect(filtered).toHaveLength(1);
    expect((filtered[0] as IfRule).elifs).toHaveLength(1);
  });
});

describe('replaceInRules', () => {
  it('标签改名同步标签、forget 与 if 条件', () => {
    const ifRule = createRule('if') as IfRule;
    ifRule.condition = { ...defaultHasExpr(), labels: ['ores'] };
    ifRule.then = [inputOver(['ores'], 'minecraft:iron_ore')];
    const rules = [ifRule];
    const { rules: next, count } = replaceInRules(rules, 'tag', 'ores', 'metals');
    expect(count).toBe(2);
    const changed = next[0] as IfRule;
    expect(changed.condition.kind === 'has' && changed.condition.labels).toEqual(['metals']);
    expect((changed.then[0] as InputRule).labels).toEqual(['metals']);
    // 原数组不被修改
    expect((ifRule.then[0] as InputRule).labels).toEqual(['ores']);
  });

  it('物品替换支持 or 列表与 except', () => {
    const rule = inputOver(['ores'], 'minecraft:iron_ore or minecraft:copper_ore');
    rule.except = ['minecraft:iron_ore'];
    const { rules: next, count } = replaceInRules([rule], 'item', 'minecraft:iron_ore', 'minecraft:gold_ore');
    expect(count).toBe(2);
    const changed = next[0] as InputRule;
    expect(changed.ops[0].resource).toBe('minecraft:gold_ore or minecraft:copper_ore');
    expect(changed.except).toEqual(['minecraft:gold_ore']);
  });

  it('没有匹配时不改内容', () => {
    const rule = inputOver(['ores'], 'minecraft:iron_ore');
    const { rules: next, count } = replaceInRules([rule], 'item', 'minecraft:coal', 'minecraft:charcoal');
    expect(count).toBe(0);
    expect(next[0]).toEqual(rule);
  });
});

describe('未知物品提示', () => {
  it('只对 minecraft: 前缀的未知 ID 报警', () => {
    const code = 'input 1 minecraft:dirt from a\ninput 1 mymod:magic from a';
    const result = parseProgram(code, { knownTags: ['a'], knownItems: ['minecraft:stone'], locale: 'zh' });
    const warnings = result.diagnostics.filter((entry) => entry.message.includes('unknownItem') || entry.message.includes('未知物品'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('minecraft:dirt');
  });

  it('已知物品与特殊资源不报警', () => {
    const code = 'input 1 minecraft:stone from a\ninput 1 fe:: from a';
    const result = parseProgram(code, {
      knownTags: ['a'],
      knownItems: ['minecraft:stone', 'fe::'],
      locale: 'zh',
    });
    expect(result.diagnostics.filter((entry) => entry.message.includes('未知物品'))).toHaveLength(0);
  });
});
