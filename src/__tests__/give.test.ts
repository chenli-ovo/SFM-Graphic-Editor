import { describe, expect, it } from 'vitest';
import { buildGiveCommand, GIVE_PAGE_LIMIT, pageComponent, splitPages } from '../lib/give';

describe('splitPages', () => {
  it('keeps short scripts on a single page', () => {
    const code = 'name "demo"\ninput from tag("ores")';
    expect(splitPages(code)).toHaveLength(1);
  });

  it('splits long scripts into pages under the limit', () => {
    const lines = Array.from({ length: 120 }, (_, index) => `# line ${index} ${'x'.repeat(10)}`);
    const pages = splitPages(lines.join('\n'));
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(GIVE_PAGE_LIMIT);
    }
    expect(pages.join('\n')).toBe(lines.join('\n'));
  });

  it('hard-splits a single oversized line', () => {
    const pages = splitPages('a'.repeat(2500));
    expect(pages).toHaveLength(3);
    expect(pages.every((page) => page.length <= GIVE_PAGE_LIMIT)).toBe(true);
  });

  it('returns no pages for empty code', () => {
    expect(splitPages('')).toEqual([]);
  });
});

describe('buildGiveCommand', () => {
  it('wraps the code into a writable book nbt page', () => {
    const code = 'name "demo"';
    const command = buildGiveCommand(code);
    const expectedPage = JSON.stringify(JSON.stringify({ text: code }));
    expect(command).toBe(`/give @p minecraft:writable_book{pages:[${expectedPage}]} 1`);
  });

  it('escapes newlines and quotes for in-game paste', () => {
    const command = buildGiveCommand('name "a"\ninput from block(top)');
    expect(command).toContain('minecraft:writable_book');
    expect(command).toContain('\\n');
    expect(command).toContain('\\"');
    expect(command).not.toContain('\n');
  });

  it('supports a custom target selector', () => {
    expect(buildGiveCommand('name "x"', '@s')).toContain('/give @s minecraft:writable_book');
  });

  it('produces multiple pages for long code', () => {
    const code = Array.from({ length: 200 }, () => 'input from tag("ores")').join('\n');
    const command = buildGiveCommand(code);
    expect(command).toContain('","');
    expect(pageComponent('a').startsWith('{"text":"')).toBe(true);
  });
});
