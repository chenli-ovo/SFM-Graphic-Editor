import { describe, expect, it } from 'vitest';
import { parseProgram } from './parse';
import { serializeProgram } from './serialize';

const KNOWN = ['a', 'b', 'c', 'fuel', 'i', 'energy', '有机灌注器', 'ores', 'storage'];

const SAMPLES: string[] = [
  'input 5 each stone or dirt from a',
  'output to empty slots in b',
  'input retain 5 each minecraft:iron_ingot from a',
  'input except minecraft:copper_ingot from a',
  'input from each a',
  'input from a top, bottom side slots 1,3-5',
  'input fe:: from energy top side',
  'input "(iron|gold)_ingot" from a',
  'input minecraft:iron_ingot,minecraft:gold_ingot from a',
  'input from a,b',
  'every 5 tick do\n  input from a\nend',
  'every 10 g + 5 seconds do\n  input from a\nend',
  'if fuel has >= 4096000 gas:: then\n  output to b\nend',
  'if i top side has >= 8 redstone:: then\n  output to b\nend',
  'if not a has > 5 then\n  output to b\nend',
  'if (a has > 5 or b has < 2) and true then\n  output to c\nend',
  'from a input 8 iron_ingot',
  'to b output',
  'forget a,b',
  'output to "有机灌注器" top side',
  'output to empty slots in b',
  'input 1 each from a slots 0',
  'every redstone pulse do\n  output to b\nend',
];

describe('official SFM syntax samples', () => {
  it.each(SAMPLES)('parses without errors: %s', (sample) => {
    const result = parseProgram(sample, { knownTags: KNOWN, locale: 'zh' });
    const errors = result.diagnostics.filter((entry) => entry.severity === 'error');
    expect(result.rules.length).toBeGreaterThan(0);
    expect(errors.map((entry) => entry.message)).toEqual([]);
  });

  it.each(SAMPLES)('round-trips through the serializer: %s', (sample) => {
    const first = parseProgram(sample, { knownTags: KNOWN, locale: 'zh' });
    const code = serializeProgram('样例', first.rules, { includeHeader: false });
    const second = parseProgram(code, { knownTags: KNOWN, locale: 'zh' });
    const errors = second.diagnostics.filter((entry) => entry.severity === 'error');
    expect(errors.map((entry) => entry.message)).toEqual([]);
    expect(second.rules.length).toBe(first.rules.length);
  });

  it('keeps comments and blank lines harmless', () => {
    const result = parseProgram('-- 这是注释\n\ninput from a -- 行尾注释\n-- 结尾', {
      knownTags: KNOWN,
      locale: 'zh',
    });
    expect(result.diagnostics.filter((entry) => entry.severity === 'error')).toHaveLength(0);
    expect(result.rules).toHaveLength(1);
  });

  it('supports statements split across lines', () => {
    const result = parseProgram('input 8 minecraft:iron_ingot\n  from a\n  top side\n  slots 0-5', {
      knownTags: KNOWN,
      locale: 'zh',
    });
    expect(result.diagnostics.filter((entry) => entry.severity === 'error')).toHaveLength(0);
    expect(result.rules).toHaveLength(1);
  });
});
