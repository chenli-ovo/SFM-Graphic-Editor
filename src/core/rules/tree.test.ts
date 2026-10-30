import { describe, expect, it } from 'vitest';
import { forgetRule, has, ifRule, inputRule, outputRule } from '../../__tests__/helpers';
import type { EveryRule, IfRule, InputRule, OutputRule } from '../types';
import {
  appendToBody,
  cloneRuleDeep,
  collectItems,
  collectTags,
  countRules,
  createRule,
  findElif,
  findRule,
  insertAfterRule,
  moveRuleInTree,
  removeRuleInTree,
  updateRuleInTree,
  walkRules,
} from './tree';

describe('rule tree', () => {
  it('createRule 生成六种规则', () => {
    const every = createRule('every') as EveryRule;
    expect(every.type).toBe('every');
    expect(every.interval).toBe(20);

    const input = createRule('input') as InputRule;
    expect(input.labels).toEqual(['?']);

    const output = createRule('output') as OutputRule;
    expect(output.labels).toEqual(['?']);

    const conditional = createRule('if') as IfRule;
    expect(conditional.condition.kind).toBe('has');
    expect(conditional.elifs).toEqual([]);

    expect(createRule('pulse').type).toBe('pulse');
    expect(createRule('forget').type).toBe('forget');
  });

  it('updateRuleInTree 修改嵌套规则', () => {
    const inner = inputRule({ labels: ['a'] });
    const rules = [ifRule({ then: [inner] })];
    const next = updateRuleInTree(rules, inner.id, { labels: ['b'] });
    const target = findRule(next, inner.id);
    expect(target?.type).toBe('input');
    if (target?.type === 'input') expect(target.labels).toEqual(['b']);
  });

  it('appendToBody 与 insertAfterRule 插入到指定分支', () => {
    const parent = ifRule({ id: 'ifx' });
    const added = outputRule({ id: 'outx', labels: ['storage'] });
    const rules = appendToBody([parent], 'ifx', 'then', added);
    expect(findRule(rules, 'outx')).toBeTruthy();

    const second = outputRule({ id: 'outy', labels: ['c'] });
    const next = insertAfterRule(rules, 'outx', second);
    const clause = (next[0] as IfRule).then;
    expect(clause.map((rule) => rule.id)).toEqual(['outx', 'outy']);
  });

  it('moveRuleInTree 上下移动同层规则', () => {
    const a = inputRule({ id: 'a' });
    const b = outputRule({ id: 'b' });
    const moved = moveRuleInTree([a, b], 'b', -1);
    expect(moved.map((rule) => rule.id)).toEqual(['b', 'a']);
  });

  it('removeRuleInTree 删除整棵子树', () => {
    const inner = inputRule({ id: 'inner' });
    const rules = [ifRule({ id: 'outer', then: [inner] })];
    const next = removeRuleInTree(rules, 'outer');
    expect(next).toHaveLength(0);
  });

  it('collectTags / collectItems 汇总标签与物品', () => {
    const rules = [
      inputRule({
        labels: ['ores'],
        ops: [
          {
            count: 1,
            countEach: false,
            retain: null,
            retainEach: false,
            resource: 'minecraft:iron_ore',
            withClause: null,
            withoutClause: null,
          },
        ],
      }),
      ifRule({ condition: has({ labels: ['storage'], value: 64 }) }),
      forgetRule({ labels: ['ores'] }),
    ];
    expect(collectTags(rules).sort()).toEqual(['ores', 'storage']);
    expect(collectItems(rules)).toContain('minecraft:iron_ore');
  });

  it('cloneRuleDeep 生成新 id 且不共享引用', () => {
    const source = ifRule({
      id: 'ifx',
      then: [inputRule({ id: 'inner' })],
      elifs: [{ id: 'elifx', condition: has({ labels: ['a'] }), body: [] }],
    });
    const clone = cloneRuleDeep(source) as IfRule;
    expect(clone.id).not.toBe(source.id);
    expect(clone.then[0].id).not.toBe(source.then[0].id);
    expect(clone.elifs[0].id).not.toBe(source.elifs[0].id);
    clone.then[0].note = 'changed';
    expect(source.then[0].note).toBe('');
  });

  it('findElif 按分支 id 定位', () => {
    const rules = [ifRule({ id: 'ifx', elifs: [{ id: 'branch', condition: has({ labels: ['a'] }), body: [] }] })];
    const clause = findElif(rules, 'branch');
    expect(clause?.id).toBe('branch');
  });

  it('walkRules / countRules 覆盖 elif 分支', () => {
    const rules = [
      ifRule({
        id: 'ifx',
        elifs: [{ id: 'branch', condition: has({ labels: ['a'] }), body: [outputRule({ id: 'o' })] }],
      }),
    ];
    const visited: string[] = [];
    walkRules(rules, (entry) => visited.push(entry.rule.id));
    expect(visited).toContain('o');
    expect(countRules(rules)).toBe(2);
  });
});
