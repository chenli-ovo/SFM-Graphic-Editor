import { describe, expect, it } from 'vitest';
import { parseProgram } from './parse';
import { serializeProgram } from './serialize';

const PROGRAM = `name "测试"
-- 注释
every 20 ticks do
  input 8 iron_ingot from ores slots 0-5
  output to furnace top side
end
if ores has > 64 then
  output to storage
else if ores has > 32 then
  input from hopper bottom side
else
  output to "原料"
end
forget ores`;

const OPTIONS = {
  knownTags: ['ores', 'furnace', 'hopper', 'storage', '原料'],
  locale: 'zh' as const,
};

describe('parse', () => {
  it('解析完整程序', () => {
    const result = parseProgram(PROGRAM, OPTIONS);
    expect(result.programName).toBe('测试');
    expect(result.diagnostics.filter((entry) => entry.severity === 'error')).toHaveLength(0);
    expect(result.rules).toHaveLength(3);

    const every = result.rules[0];
    expect(every.type).toBe('every');
    if (every.type !== 'every') return;
    expect(every.interval).toBe(20);
    expect(every.unit).toBe('ticks');
    expect(every.body).toHaveLength(2);

    const input = every.body[0];
    expect(input.type).toBe('input');
    if (input.type !== 'input') return;
    expect(input.labels).toEqual(['ores']);
    expect(input.slots).toBe('0-5');
    expect(input.ops[0]?.count).toBe(8);
    expect(input.ops[0]?.resource).toBe('iron_ingot');

    const output = every.body[1];
    expect(output.type).toBe('output');
    if (output.type !== 'output') return;
    expect(output.labels).toEqual(['furnace']);
    expect(output.sides).toEqual({ mode: 'list', sides: ['top'] });

    const conditional = result.rules[1];
    expect(conditional.type).toBe('if');
    if (conditional.type !== 'if') return;
    expect(conditional.condition.kind).toBe('has');
    if (conditional.condition.kind === 'has') {
      expect(conditional.condition.labels).toEqual(['ores']);
      expect(conditional.condition.value).toBe(64);
    }
    expect(conditional.elifs).toHaveLength(1);
    expect(conditional.else).toHaveLength(1);

    const forget = result.rules[2];
    expect(forget.type).toBe('forget');
    if (forget.type !== 'forget') return;
    expect(forget.labels).toEqual(['ores']);
  });

  it('支持倒装写法 from ... input / to ... output', () => {
    const result = parseProgram('from ores input 8 iron_ingot\nto storage output', {
      knownTags: ['ores', 'storage'],
      locale: 'zh',
    });
    expect(result.diagnostics.filter((entry) => entry.severity === 'error')).toHaveLength(0);
    expect(result.rules).toHaveLength(2);
    const [input, output] = result.rules;
    expect(input.type).toBe('input');
    if (input.type === 'input') {
      expect(input.labels).toEqual(['ores']);
      expect(input.ops[0]?.count).toBe(8);
    }
    expect(output.type).toBe('output');
    if (output.type === 'output') expect(output.labels).toEqual(['storage']);
  });

  it('占位标签产生 error 诊断', () => {
    const result = parseProgram('input from ?', { knownTags: [], locale: 'zh' });
    expect(result.rules).toHaveLength(1);
    expect(result.diagnostics.some((entry) => entry.severity === 'error')).toBe(true);
  });

  it('未定义标签给 warning 与 define-tag 修复', () => {
    const result = parseProgram('input from unknown_tag', { knownTags: ['ores'], locale: 'zh' });
    const warning = result.diagnostics.find((entry) => entry.severity === 'warning');
    expect(warning).toBeTruthy();
    expect(warning?.fix?.kind).toBe('define-tag');
    expect(warning?.fix?.tagName).toBe('unknown_tag');
  });

  it('round-trip 序列化后再次解析不丢规则', () => {
    const first = parseProgram(PROGRAM, OPTIONS);
    const code = serializeProgram('测试', first.rules);
    const second = parseProgram(code, OPTIONS);
    expect(second.rules).toHaveLength(first.rules.length);
    expect(second.diagnostics.filter((entry) => entry.severity === 'error')).toHaveLength(0);
  });

  it('记录 ruleLines 与 lineToRule 供滚动联动使用', () => {
    const result = parseProgram(PROGRAM, OPTIONS);
    const every = result.rules[0];
    expect(result.ruleLines[every.id]).toEqual({ start: 3, end: 6 });
    if (every.type !== 'every') return;
    expect(result.lineToRule[4]).toBe(every.body[0].id);
  });

  it('未知语句产生错误但继续解析', () => {
    const result = parseProgram('bogus statement\ninput from ores', { knownTags: ['ores'], locale: 'zh' });
    expect(result.diagnostics.some((entry) => entry.severity === 'error')).toBe(true);
    expect(result.rules.some((rule) => rule.type === 'input')).toBe(true);
  });
});
