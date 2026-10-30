import { describe, expect, it } from 'vitest';
import {
  buildShareUrl,
  decodeShare,
  encodeShare,
  readShareFromHash,
  SHARE_VERSION,
} from '../lib/share';
import { createRule } from '../core/rules/tree';
import type { Tag } from '../core/types';

const sampleTags = [
  { id: 'tag-1', name: 'ores', color: '#34d399', note: '' },
  { id: 'tag-2', name: 'storage', color: '#fbbf24', note: '' },
] as Tag[];

describe('share encode/decode', () => {
  it('round-trips project name, rules and tags', () => {
    const rules = [createRule('every'), createRule('input')];
    const token = encodeShare('熔炼工厂', rules, sampleTags);
    expect(token.length).toBeGreaterThan(0);

    const payload = decodeShare(token);
    expect(payload).not.toBeNull();
    expect(payload?.version).toBe(SHARE_VERSION);
    expect(payload?.name).toBe('熔炼工厂');
    expect(payload?.rules).toHaveLength(2);
    expect(payload?.rules[0].type).toBe('every');
    expect(payload?.rules[1].type).toBe('input');
    expect(payload?.tags.map((tag) => tag.name)).toEqual(['ores', 'storage']);
  });

  it('accepts an empty rule list', () => {
    const payload = decodeShare(encodeShare('empty', [], []));
    expect(payload?.rules).toEqual([]);
    expect(payload?.tags).toEqual([]);
  });

  it('returns null for corrupted tokens', () => {
    expect(decodeShare('not-a-real-token')).toBeNull();
    expect(decodeShare('')).toBeNull();
  });

  it('reads share token from a location hash', () => {
    const token = encodeShare('分享', [createRule('output')], []);
    const payload = readShareFromHash(`#share=${token}`);
    expect(payload?.name).toBe('分享');
    expect(payload?.rules[0].type).toBe('output');
    expect(readShareFromHash('#other=1')).toBeNull();
    expect(readShareFromHash('')).toBeNull();
  });

  it('builds a share URL that replaces any existing hash', () => {
    const url = buildShareUrl('https://example.com/app/index.html#old', 'ABC');
    expect(url).toBe('https://example.com/app/index.html#share=ABC');
  });
});
