/**
 * Minecraft 全量物品注册表（1.20）+ 查询工具。
 *
 * 数据来自 `registry-data.ts`（构建期由 `.tmp/gen-registry.mjs` 生成）：
 * 共 1254 个物品，包含中英文名称，用于补全、搜索、物品库和未知 ID 校验。
 */
import type { ItemCategory } from '../types';
import { CATEGORIES } from './items';
import { REGISTRY_RAW, REGISTRY_VERSION } from './registry-data';

export { REGISTRY_VERSION };

export interface RegistryItem {
  id: string;
  zh: string;
  en: string;
  category: ItemCategory;
  icon: string;
}

const ICONS: Record<ItemCategory, string> = {
  ore: '⛏️',
  ingot: '🔩',
  gem: '💎',
  dust: '✨',
  food: '🍎',
  redstone: '🔴',
  machine: '⚙️',
  storage: '📦',
  misc: '🧱',
};

const FOOD = new Set([
  'apple', 'golden_apple', 'enchanted_golden_apple', 'bread', 'porkchop', 'cooked_porkchop',
  'beef', 'cooked_beef', 'chicken', 'cooked_chicken', 'mutton', 'cooked_mutton', 'rabbit',
  'cooked_rabbit', 'rabbit_stew', 'cod', 'cooked_cod', 'salmon', 'cooked_salmon', 'tropical_fish',
  'pufferfish', 'potato', 'baked_potato', 'poisonous_potato', 'carrot', 'golden_carrot',
  'beetroot', 'beetroot_soup', 'melon_slice', 'pumpkin_pie', 'cookie', 'cake', 'mushroom_stew',
  'suspicious_stew', 'dried_kelp', 'sweet_berries', 'glow_berries', 'honey_bottle',
  'chorus_fruit', 'popped_chorus_fruit', 'rotten_flesh', 'spider_eye', 'milk_bucket',
]);

const MACHINES = new Set([
  'furnace', 'blast_furnace', 'smoker', 'crafting_table', 'crafter', 'enchanting_table',
  'brewing_stand', 'stonecutter', 'anvil', 'chipped_anvil', 'damaged_anvil', 'smithing_table',
  'loom', 'cartography_table', 'fletching_table', 'grindstone', 'lectern', 'campfire',
  'soul_campfire', 'beacon', 'conduit', 'respawn_anchor', 'bell', 'composter', 'cauldron',
]);

const STORAGE = new Set([
  'chest', 'trapped_chest', 'ender_chest', 'barrel', 'shulker_box', 'hopper', 'dispenser',
  'dropper', 'bookshelf', 'chiseled_bookshelf', 'decorated_pot',
]);

const REDSTONE = new Set([
  'repeater', 'comparator', 'piston', 'sticky_piston', 'observer', 'redstone_lamp', 'lever',
  'target', 'daylight_detector', 'tripwire_hook', 'note_block', 'jukebox', 'redstone_torch',
  'redstone_block', 'redstone', 'sculk_sensor', 'calibrated_sculk_sensor', 'sculk_shrieker',
  'lightning_rod', 'tnt',
]);

function categoryOf(id: string): ItemCategory {
  const path = id.startsWith('minecraft:') ? id.slice('minecraft:'.length) : id;
  if (FOOD.has(path)) return 'food';
  if (STORAGE.has(path)) return 'storage';
  if (MACHINES.has(path)) return 'machine';
  if (REDSTONE.has(path) || path.endsWith('_button') || path.endsWith('_pressure_plate')) return 'redstone';
  if (path.endsWith('_shulker_box')) return 'storage';
  if (path.endsWith('_ore') || path.startsWith('raw_') || path === 'ancient_debris') return 'ore';
  if (path.endsWith('_ingot') || path.endsWith('_nugget') || path === 'netherite_scrap') return 'ingot';
  if (path.endsWith('_dust')) return 'dust';
  if (['diamond', 'emerald', 'lapis_lazuli', 'quartz', 'amethyst_shard', 'echo_shard'].includes(path)) return 'gem';
  if (['coal', 'charcoal', 'glowstone_dust', 'gunpowder', 'blaze_powder', 'sugar', 'glow_ink_sac'].includes(path)) {
    return 'dust';
  }
  return 'misc';
}

let itemsCache: RegistryItem[] | null = null;

/** 全部注册表物品（按物品数字 ID 排序，惰性解析） */
export function registryItems(): RegistryItem[] {
  if (itemsCache) return itemsCache;
  itemsCache = REGISTRY_RAW.split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, zh, en] = line.split('|');
      const category = categoryOf(id);
      return { id, zh: zh || en, en: en || zh, category, icon: ICONS[category] };
    });
  return itemsCache;
}

/** 全部合法资源 ID（含流体，用于未知 ID 校验） */
export const SPECIAL_RESOURCES = ['minecraft:water', 'minecraft:lava', 'minecraft:milk', 'fe::', 'gas::'];

let idSetCache: Set<string> | null = null;
export function registryIdSet(): Set<string> {
  if (!idSetCache) {
    idSetCache = new Set(registryItems().map((item) => item.id));
    SPECIAL_RESOURCES.forEach((id) => idSetCache!.add(id));
  }
  return idSetCache;
}

let byIdCache: Map<string, RegistryItem> | null = null;
export function registryById(id: string): RegistryItem | undefined {
  if (!byIdCache) {
    byIdCache = new Map(registryItems().map((item) => [item.id, item]));
  }
  return byIdCache.get(id);
}

/** 按当前语言取物品名，未知物品返回 undefined */
export function registryName(id: string, locale: 'zh' | 'en'): string | undefined {
  const entry = registryById(id);
  if (!entry) return undefined;
  return locale === 'zh' ? entry.zh : entry.en;
}

export function categoryIcon(category: ItemCategory): string {
  return ICONS[category];
}

export function categoryLabel(category: ItemCategory, locale: 'zh' | 'en'): string {
  const entry = CATEGORIES.find((candidate) => candidate.id === category);
  return entry ? (locale === 'zh' ? entry.zh : entry.en) : category;
}

/**
 * 注册表搜索：支持中文名、英文名、完整 ID 与路径片段。
 * 排序优先级：精确 ID > ID 前缀 > 中文前缀 > 包含。
 */
export function searchRegistry(query: string, limit = 60): RegistryItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const scored: Array<{ item: RegistryItem; score: number }> = [];
  for (const item of registryItems()) {
    const path = item.id.replace(/^minecraft:/, '').toLowerCase();
    const zh = item.zh.toLowerCase();
    const en = item.en.toLowerCase();
    let score = -1;
    if (path === needle || item.id === needle) score = 0;
    else if (path.startsWith(needle) || item.id.startsWith(needle)) score = 1;
    else if (zh.startsWith(needle)) score = 2;
    else if (en.startsWith(needle)) score = 3;
    else if (path.includes(needle) || zh.includes(needle) || en.includes(needle)) score = 4;
    if (score >= 0) scored.push({ item, score });
  }
  scored.sort((a, b) => a.score - b.score || a.item.id.localeCompare(b.item.id));
  return scored.slice(0, limit).map((entry) => entry.item);
}

/** 供补全使用的英文 ID 列表 */
export function registryIds(): string[] {
  return registryItems().map((item) => item.id);
}
