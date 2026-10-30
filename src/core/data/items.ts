import type { Item, ItemCategory } from '../types';

export const CATEGORIES: Array<{ id: ItemCategory; zh: string; en: string; icon: string }> = [
  { id: 'ore', zh: '矿石', en: 'Ores', icon: '⛏️' },
  { id: 'ingot', zh: '锭材', en: 'Ingots', icon: '🔩' },
  { id: 'gem', zh: '宝石', en: 'Gems', icon: '💎' },
  { id: 'dust', zh: '粉末', en: 'Dusts', icon: '✨' },
  { id: 'food', zh: '食物', en: 'Food', icon: '🍎' },
  { id: 'redstone', zh: '红石', en: 'Redstone', icon: '🔴' },
  { id: 'machine', zh: '机器', en: 'Machines', icon: '⚙️' },
  { id: 'storage', zh: '存储', en: 'Storage', icon: '📦' },
  { id: 'misc', zh: '杂项', en: 'Misc', icon: '🧱' },
];

const raw: Array<[string, string, ItemCategory, string]> = [
  // 矿石
  ['minecraft:coal_ore', '煤矿石', 'ore', '⛏️'],
  ['minecraft:iron_ore', '铁矿石', 'ore', '⛏️'],
  ['minecraft:copper_ore', '铜矿石', 'ore', '⛏️'],
  ['minecraft:gold_ore', '金矿石', 'ore', '⛏️'],
  ['minecraft:redstone_ore', '红石矿石', 'ore', '⛏️'],
  ['minecraft:lapis_ore', '青金石矿石', 'ore', '⛏️'],
  ['minecraft:diamond_ore', '钻石矿石', 'ore', '⛏️'],
  ['minecraft:emerald_ore', '绿宝石矿石', 'ore', '⛏️'],
  ['minecraft:nether_gold_ore', '下界金矿石', 'ore', '⛏️'],
  ['minecraft:ancient_debris', '远古残骸', 'ore', '⛏️'],
  ['minecraft:deepslate_iron_ore', '深层铁矿石', 'ore', '⛏️'],
  ['minecraft:raw_iron', '粗铁', 'ore', '🪨'],
  ['minecraft:raw_copper', '粗铜', 'ore', '🪨'],
  ['minecraft:raw_gold', '粗金', 'ore', '🪨'],
  // 锭
  ['minecraft:iron_ingot', '铁锭', 'ingot', '🔩'],
  ['minecraft:gold_ingot', '金锭', 'ingot', '🔩'],
  ['minecraft:copper_ingot', '铜锭', 'ingot', '🔩'],
  ['minecraft:netherite_ingot', '下界合金锭', 'ingot', '🔩'],
  ['minecraft:netherite_scrap', '下界合金碎片', 'ingot', '🔩'],
  // 宝石
  ['minecraft:diamond', '钻石', 'gem', '💎'],
  ['minecraft:emerald', '绿宝石', 'gem', '💎'],
  ['minecraft:lapis_lazuli', '青金石', 'gem', '💎'],
  ['minecraft:quartz', '下界石英', 'gem', '💎'],
  ['minecraft:amethyst_shard', '紫水晶碎片', 'gem', '💎'],
  ['minecraft:coal', '煤炭', 'dust', '✨'],
  ['minecraft:charcoal', '木炭', 'dust', '✨'],
  ['minecraft:redstone', '红石', 'dust', '🔴'],
  ['minecraft:glowstone_dust', '荧石粉', 'dust', '✨'],
  ['minecraft:gunpowder', '火药', 'dust', '✨'],
  ['minecraft:blaze_powder', '烈焰粉', 'dust', '✨'],
  ['minecraft:sugar', '糖', 'dust', '✨'],
  // 食物
  ['minecraft:apple', '苹果', 'food', '🍎'],
  ['minecraft:bread', '面包', 'food', '🍞'],
  ['minecraft:cooked_beef', '牛排', 'food', '🥩'],
  ['minecraft:golden_apple', '金苹果', 'food', '🍎'],
  ['minecraft:carrot', '胡萝卜', 'food', '🥕'],
  ['minecraft:baked_potato', '烤马铃薯', 'food', '🥔'],
  // 红石
  ['minecraft:repeater', '红石中继器', 'redstone', '🔴'],
  ['minecraft:comparator', '红石比较器', 'redstone', '🔴'],
  ['minecraft:piston', '活塞', 'redstone', '🔴'],
  ['minecraft:sticky_piston', '粘性活塞', 'redstone', '🔴'],
  ['minecraft:observer', '侦测器', 'redstone', '🔴'],
  ['minecraft:dispenser', '发射器', 'redstone', '🔴'],
  ['minecraft:dropper', '投掷器', 'redstone', '🔴'],
  ['minecraft:redstone_lamp', '红石灯', 'redstone', '🔴'],
  // 机器
  ['minecraft:furnace', '熔炉', 'machine', '⚙️'],
  ['minecraft:blast_furnace', '高炉', 'machine', '⚙️'],
  ['minecraft:smoker', '烟熏炉', 'machine', '⚙️'],
  ['minecraft:crafting_table', '工作台', 'machine', '⚙️'],
  ['minecraft:crafter', '合成器', 'machine', '⚙️'],
  ['minecraft:enchanting_table', '附魔台', 'machine', '⚙️'],
  ['minecraft:brewing_stand', '酿造台', 'machine', '⚙️'],
  ['minecraft:stonecutter', '切石机', 'machine', '⚙️'],
  // 存储
  ['minecraft:chest', '箱子', 'storage', '📦'],
  ['minecraft:barrel', '木桶', 'storage', '📦'],
  ['minecraft:shulker_box', '潜影盒', 'storage', '📦'],
  ['minecraft:hopper', '漏斗', 'storage', '📦'],
  ['minecraft:trapped_chest', '陷阱箱', 'storage', '📦'],
  ['minecraft:ender_chest', '末影箱', 'storage', '📦'],
  // 杂项
  ['minecraft:cobblestone', '圆石', 'misc', '🧱'],
  ['minecraft:stone', '石头', 'misc', '🧱'],
  ['minecraft:sand', '沙子', 'misc', '🧱'],
  ['minecraft:glass', '玻璃', 'misc', '🧱'],
  ['minecraft:oak_log', '橡木原木', 'misc', '🧱'],
  ['minecraft:oak_planks', '橡木木板', 'misc', '🧱'],
  ['minecraft:obsidian', '黑曜石', 'misc', '🧱'],
  ['minecraft:netherrack', '下界岩', 'misc', '🧱'],
  ['minecraft:gravel', '砂砾', 'misc', '🧱'],
  ['minecraft:cobbled_deepslate', '深板岩圆石', 'misc', '🧱'],
];

export const DEFAULT_ITEMS: Item[] = raw.map(([id, name], index) => ({
  id,
  name,
  category: raw[index][2],
  icon: raw[index][3],
  custom: false,
}));

export function shortItemId(id: string): string {
  return id.replace(/^minecraft:/, '');
}
