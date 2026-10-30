/** 短小、无依赖的 ID 生成器（crypto 不可用时降级） */
export function newId(prefix = ''): string {
  const c = globalThis.crypto;
  let raw: string;
  if (c && typeof c.randomUUID === 'function') {
    raw = c.randomUUID().replace(/-/g, '').slice(0, 12);
  } else {
    raw = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  return prefix ? `${prefix}_${raw}` : raw;
}
