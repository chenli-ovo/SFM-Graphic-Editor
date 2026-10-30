import { describe, expect, it } from 'vitest';
import { everyRule, inputRule, outputRule, pulseRule } from '../../__tests__/helpers';
import type { Tag } from '../types';
import { analyzeTopology } from './topology';

const TAGS: Tag[] = [
  { id: 't1', name: 'a', color: '#22c55e', note: '' },
  { id: 't2', name: 'b', color: '#60a5fa', note: '' },
  { id: 't3', name: 'c', color: '#f59e0b', note: '' },
];

describe('topology', () => {
  it('input → output 生成节点与边', () => {
    const rules = [inputRule({ id: 'i', labels: ['a'] }), outputRule({ id: 'o', labels: ['b'] })];
    const { data } = analyzeTopology(rules, TAGS, 'zh');
    expect(data.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(['label:a', 'label:b']));
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0].from).toBe('label:a');
    expect(data.edges[0].to).toBe('label:b');
  });

  it('镜像 IO 形成闭环告警', () => {
    const rules = [
      inputRule({ id: 'i1', labels: ['a'] }),
      outputRule({ id: 'o1', labels: ['b'] }),
      inputRule({ id: 'i2', labels: ['b'] }),
      outputRule({ id: 'o2', labels: ['a'] }),
    ];
    const { warnings } = analyzeTopology(rules, TAGS, 'zh');
    expect(warnings.some((warning) => warning.kind === 'cycle')).toBe(true);
  });

  it('输入输出数量不配平', () => {
    const rules = [
      inputRule({ id: 'i1', labels: ['a'] }),
      inputRule({ id: 'i2', labels: ['b'] }),
      outputRule({ id: 'o', labels: ['c'] }),
    ];
    const { warnings } = analyzeTopology(rules, TAGS, 'zh');
    expect(warnings.some((warning) => warning.kind === 'unbalanced')).toBe(true);
  });

  it('every tick 触发繁忙告警', () => {
    const rules = [everyRule({ interval: 1, unit: 'ticks' })];
    const { warnings } = analyzeTopology(rules, TAGS, 'zh');
    expect(warnings.some((warning) => warning.kind === 'busy')).toBe(true);
  });

  it('定时块内部的 IO 单独成为一个作用域', () => {
    const rules = [
      everyRule({ body: [inputRule({ id: 'i', labels: ['a'] }), outputRule({ id: 'o', labels: ['b'] })] }),
      inputRule({ id: 'top', labels: ['c'] }),
    ];
    const { data } = analyzeTopology(rules, TAGS, 'zh');
    expect(data.edges.some((edge) => edge.from === 'label:a' && edge.to === 'label:b')).toBe(true);
    expect(data.edges.some((edge) => edge.from === 'label:c')).toBe(false);
  });

  it('空规则返回空拓扑', () => {
    const { data, warnings } = analyzeTopology([pulseRule()], TAGS, 'zh');
    expect(data.nodes).toHaveLength(0);
    expect(data.edges).toHaveLength(0);
    expect(warnings.some((warning) => warning.kind === 'unbalanced')).toBe(false);
  });
});
