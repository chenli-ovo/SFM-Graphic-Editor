import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { normalizeRules, normalizeTags } from '../core/store/io';
import type { Rule, Tag } from '../core/types';

export const SHARE_VERSION = 1;

export interface SharePayload {
  version: number;
  name: string;
  rules: Rule[];
  tags: Tag[];
  createdAt: number;
}

/** 把项目精简为分享载荷并压缩成 URL 安全的字符串 */
export function encodeShare(name: string, rules: Rule[], tags: Tag[]): string {
  const payload: SharePayload = {
    version: SHARE_VERSION,
    name: name.trim() || '分享的项目',
    rules,
    tags,
    createdAt: Date.now(),
  };
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

/** 解压并宽松校验分享字符串，损坏时返回 null */
export function decodeShare(token: string): SharePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(token);
    if (!json) return null;
    const raw: unknown = JSON.parse(json);
    if (!raw || typeof raw !== 'object') return null;
    const data = raw as Record<string, unknown>;
    if (!Array.isArray(data.rules)) return null;
    const rules = normalizeRules(data.rules);
    if (!rules.length && data.rules.length > 0) return null;
    return {
      version: typeof data.version === 'number' ? data.version : SHARE_VERSION,
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '分享的项目',
      rules,
      tags: Array.isArray(data.tags) ? normalizeTags(data.tags) : [],
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/** 从 location.hash 中提取 share=... 并解码 */
export function readShareFromHash(hash: string): SharePayload | null {
  const match = /(?:^|[#&])share=([^&]+)/.exec(hash);
  if (!match) return null;
  return decodeShare(decodeURIComponent(match[1]));
}

/** 生成完整分享链接（保留原有路径与查询参数，只替换 hash） */
export function buildShareUrl(baseUrl: string, token: string): string {
  return `${baseUrl.split('#')[0]}#share=${token}`;
}

/** 当前项目 → 分享链接 */
export function createShareUrl(name: string, rules: Rule[], tags: Tag[], baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.href : 'https://sfm.studio/');
  return buildShareUrl(base, encodeShare(name, rules, tags));
}
