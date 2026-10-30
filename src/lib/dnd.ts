import type { DragEvent } from 'react';

export type DragPayload = { kind: 'item'; value: string } | { kind: 'tag'; value: string };

/** 统一的拖拽数据格式：item:minecraft:iron_ingot / tag:ores */
export function setDragPayload(event: DragEvent, payload: DragPayload): void {
  event.stopPropagation();
  event.dataTransfer.setData('text/plain', `${payload.kind}:${payload.value}`);
  event.dataTransfer.effectAllowed = 'copy';
}

export function readDragPayload(event: DragEvent): DragPayload | null {
  const text = event.dataTransfer.getData('text/plain');
  if (!text) return null;
  const separator = text.indexOf(':');
  if (separator <= 0) return null;
  const kind = text.slice(0, separator);
  const value = text.slice(separator + 1);
  if (!value) return null;
  if (kind === 'item' || kind === 'tag') return { kind, value };
  return null;
}

export function isDragEventSupported(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer.types);
  return types.includes('text/plain');
}
