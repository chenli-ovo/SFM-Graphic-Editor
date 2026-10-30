import { describe, expect, it } from 'vitest';
import { everyRule, forgetRule, has, ifRule, inputRule, outputRule, pulseRule, sides } from '../../__tests__/helpers';
import type { BoolExpr } from '../types';
import { exprToText, ioOpToText, ioRuleBody, labelToText, serializeProgram, serializeRule } from './serialize';

describe('serialize', () => {
  it('标签按需加引号', () => {
    expect(labelToText('ores')).toBe('ores');
    expect(labelToText('原料')).toBe('"原料"');
    expect(labelToText('minecraft:iron_ingot')).toBe('"minecraft:iron_ingot"');
    expect(labelToText('')).toBe('"?"');
  });

  it('input 操作项：数量 / retain / resource / with', () => {
    expect(
      ioOpToText({
        count: 8,
        countEach: true,
        retain: 4,
        retainEach: false,
        resource: 'minecraft:iron_ingot',
        withClause: 'tag #ores',
        withoutClause: null,
      }),
    ).toBe('8 each retain 4 minecraft:iron_ingot with tag #ores');
  });

  it('input 完整定位：标签 + 朝向 + 槽位', () => {
    const rule = inputRule({
      labels: ['a'],
      sides: sides(['top']),
      slots: '0-5',
      ops: [
        {
          count: 8,
          countEach: false,
          retain: null,
          retainEach: false,
          resource: 'minecraft:iron_ingot',
          withClause: null,
          withoutClause: null,
        },
      ],
    });
    expect(ioRuleBody(rule)).toBe('input 8 minecraft:iron_ingot from a top side slots 0-5');
  });

  it('output 支持 empty slots in / each / round robin / 多朝向', () => {
    const rule = outputRule({
      labels: ['b'],
      each: true,
      roundRobin: 'label',
      emptySlotsIn: true,
      sides: sides(['top', 'bottom']),
      slots: '1,3-5',
      except: ['minecraft:cobblestone'],
    });
    expect(ioRuleBody(rule)).toBe(
      'output except minecraft:cobblestone to empty slots in each b round robin by label top, bottom side slots 1,3-5',
    );
  });

  it('条件表达式括号与取反', () => {
    const expr: BoolExpr = {
      kind: 'not',
      expr: { kind: 'and', left: { kind: 'const', value: true }, right: has({ labels: ['ores'], value: 5 }) },
    };
    expect(exprToText(expr)).toBe('not (true and ores has > 5)');
  });

  it('has 表达式完整写法', () => {
    const expr = has({
      labels: ['燃料'],
      setOp: 'some',
      sides: sides(['top']),
      slots: '0-5',
      op: 'ge',
      value: 4096000,
      resource: 'gas::',
      withClause: 'tag #fuel',
      except: ['minecraft:coal'],
    });
    expect(exprToText(expr)).toBe(
      'some "燃料" top side slots 0-5 has >= 4096000 gas:: with tag #fuel except minecraft:coal',
    );
  });

  it('redstone 条件', () => {
    expect(exprToText({ kind: 'redstone', op: null, value: null })).toBe('redstone');
    expect(exprToText({ kind: 'redstone', op: 'gt', value: 0 })).toBe('redstone > 0');
  });

  it('every 支持 global 与 offset', () => {
    const rule = everyRule({ interval: 10, unit: 'seconds', global: true, offset: 5 });
    expect(serializeRule(rule)).toContain('every 10 g + 5 seconds do');
  });

  it('pulse 使用官方 every redstone pulse', () => {
    expect(serializeRule(pulseRule())).toContain('every redstone pulse do');
  });

  it('if / else if / else 链', () => {
    const rule = ifRule({
      condition: has({ labels: ['ores'], value: 64 }),
      then: [outputRule({ id: 'o2', labels: ['storage'] })],
      elifs: [{ id: 'e1', condition: has({ labels: ['ores'], value: 32 }), body: [] }],
      else: [forgetRule({ labels: ['ores'] })],
    });
    const code = serializeRule(rule).join('\n');
    expect(code).toContain('if ores has > 64 then');
    expect(code).toContain('else if ores has > 32 then');
    expect(code).toContain('else');
    expect(code).toContain('forget ores');
  });

  it('serializeProgram 生成可读代码与注释', () => {
    const code = serializeProgram('熔炼工厂', [
      everyRule({ body: [inputRule({ labels: ['ores'] }), outputRule({ labels: ['furnace'] })] }),
    ]);
    expect(code).toContain('name "熔炼工厂"');
    expect(code).toContain('every 20 ticks do');
    expect(code).toContain('  input from ores');
    expect(code).toContain('  output to furnace');
    expect(code).toContain('end');
    expect(code).toContain('--');
  });

  it('空规则给出提示且不崩溃', () => {
    const code = serializeProgram('empty', []);
    expect(code).toContain('name "empty"');
    expect(code).toContain('--');
  });
});
