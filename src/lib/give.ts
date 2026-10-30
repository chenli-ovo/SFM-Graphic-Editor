/** Java 版 writable_book 每页上限 1024 字符，留一点余量给 JSON 组件结构 */
export const GIVE_PAGE_LIMIT = 1000;

/** 按行切分成不超过 limit 字符的书页，超长单行强制硬切 */
export function splitPages(code: string, limit = GIVE_PAGE_LIMIT): string[] {
  if (!code) return [];
  const pages: string[] = [];
  let current = '';
  const pushCurrent = () => {
    if (current) pages.push(current);
    current = '';
  };
  for (const line of code.split('\n')) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > limit && current) {
      pushCurrent();
      current = line;
    } else {
      current = candidate;
    }
    while (current.length > limit) {
      pages.push(current.slice(0, limit));
      current = current.slice(limit);
    }
  }
  pushCurrent();
  return pages;
}

/** 书页内容：Minecraft 文本组件 JSON 字符串 */
export function pageComponent(page: string): string {
  return JSON.stringify({ text: page });
}

/**
 * 生成可直接在游戏里粘贴的 /give 指令。
 * 书页 NBT 是字符串数组，元素本身必须是 JSON 文本，因此需要双层 JSON 转义。
 */
export function buildGiveCommand(code: string, target = '@p'): string {
  const pages = splitPages(code).map((page) => JSON.stringify(pageComponent(page)));
  return `/give ${target} minecraft:writable_book{pages:[${pages.join(',')}]} 1`;
}
