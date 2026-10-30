import { describe, expect, it } from 'vitest';
import { everyRule, forgetRule, has, ifRule, inputRule, outputRule } from '../../__tests__/helpers';
import { buildSimulation } from './simulator';

describe('simulator', () => {
  it('定时块按行产生 every / input / output 事件', () => {
    const every = everyRule({
      id: 'e',
      body: [
        inputRule({ id: 'i', labels: ['a'] }),
        outputRule({ id: 'o', labels: ['b'] }),
      ],
    });
    const lines = {
      e: { start: 1, end: 4 },
      i: { start: 2, end: 2 },
      o: { start: 3, end: 3 },
    };
    const result = buildSimulation([every], lines, 'zh');
    expect(result.events.map((event) => event.kind)).toEqual(['every', 'input', 'output']);
    expect(result.totalTicks).toBe(3);
    expect(result.inputs).toBe(1);
    expect(result.outputs).toBe(1);
    expect(result.events[1].line).toBe(2);
  });

  it('if / else if / else 产生分支事件', () => {
    const rule = ifRule({
      id: 'f',
      condition: has({ labels: ['ores'], value: 64 }),
      then: [outputRule({ id: 't', labels: ['a'] })],
      elifs: [{ id: 'e1', condition: has({ labels: ['ores'], value: 32 }), body: [outputRule({ id: 't2', labels: ['b'] })] }],
      else: [forgetRule({ id: 'f2', labels: ['ores'] })],
    });
    const result = buildSimulation([rule], {}, 'zh');
    const kinds = result.events.map((event) => event.kind);
    expect(kinds).toContain('if');
    expect(kinds).toContain('info');
    expect(result.events.some((event) => event.message.includes('清空'))).toBe(true);
  });

  it('forget 单独产生事件', () => {
    const result = buildSimulation([forgetRule({ labels: ['ores'] })], {}, 'zh');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].kind).toBe('info');
  });

  it('空规则给出 warning', () => {
    const result = buildSimulation([], {}, 'zh');
    expect(result.events).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('无效间隔产生 error 事件', () => {
    const result = buildSimulation([everyRule({ id: 'e', interval: 0 })], {}, 'zh');
    expect(result.events.some((event) => event.kind === 'error')).toBe(true);
  });
});
