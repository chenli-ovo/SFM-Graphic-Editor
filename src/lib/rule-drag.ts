/**
 * 规则卡片拖拽排序的全局状态。
 *
 * 用 HTML5 原生拖拽（与侧栏标签/物品拖拽保持一致），
 * 不依赖 dnd-kit 的 DOM 测量，避免在滚动容器中 transform 失效。
 */
let draggingRuleId: string | null = null;

export function setDraggingRule(id: string | null): void {
  draggingRuleId = id;
}

export function getDraggingRule(): string | null {
  return draggingRuleId;
}

export function moveArrayItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
