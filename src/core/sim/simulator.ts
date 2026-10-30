import type { Locale, Rule, SimEvent, SimulationResult } from '../types';
import { exprToText, labelsToText, sideSpecToText } from '../parser/serialize';

export type RuleLineMap = Record<string, { start: number; end: number }>;

const MAX_EVENTS = 600;

function locationText(rule: Rule): string {
  if (rule.type !== 'input' && rule.type !== 'output') return '';
  const labels = labelsToText(rule.labels);
  const sides = sideSpecToText(rule.sides);
  const where = [labels, sides].filter(Boolean).join(' ');
  return where || (rule.labels.length ? labels : '?');
}

/** 生成一次"逐行执行"的模拟事件序列（纯函数，便于测试） */
export function buildSimulation(
  rules: Rule[],
  ruleLines: RuleLineMap,
  locale: Locale,
): SimulationResult {
  const zh = locale === 'zh';
  const events: SimEvent[] = [];
  const warnings: string[] = [];
  let tick = 0;
  let inputs = 0;
  let outputs = 0;

  const lineFor = (ruleId: string): number => ruleLines[ruleId]?.start ?? 0;

  const push = (rule: Rule, kind: SimEvent['kind'], message: string, amount?: number): void => {
    if (events.length >= MAX_EVENTS) return;
    events.push({ tick, line: lineFor(rule.id), ruleId: rule.id, kind, message, amount });
  };

  const walk = (list: Rule[]): void => {
    for (const rule of list) {
      tick += 1;
      switch (rule.type) {
        case 'every': {
          const unit = rule.unit === 'seconds' ? (zh ? '秒' : 's') : zh ? 'tick' : 'ticks';
          const extra = [rule.global ? 'global' : '', rule.offset !== null ? `+${rule.offset}` : '']
            .filter(Boolean)
            .join(' ');
          push(rule, 'every', zh
            ? `每 ${rule.interval ?? '?'} ${unit}${extra ? `（${extra}）` : ''} 触发定时块`
            : `Interval block every ${rule.interval ?? '?'} ${unit}${extra ? ` (${extra})` : ''}`);
          if (rule.interval !== null && rule.interval <= 0) {
            push(rule, 'error', zh ? '执行间隔无效，规则不会运行' : 'Invalid interval, rule never runs');
          }
          walk(rule.body);
          break;
        }
        case 'pulse':
          push(rule, 'pulse', zh ? '红石脉冲触发脉冲块' : 'Redstone pulse triggers the block');
          walk(rule.body);
          break;
        case 'input': {
          inputs += 1;
          const amount = rule.ops.reduce((sum, op) => sum + (op.count ?? 1), 0) || 1;
          push(rule, 'input', zh
            ? `从 ${locationText(rule)} 抽取 ${amount} 个物品`
            : `Extract ${amount} item(s) from ${locationText(rule)}`, amount);
          break;
        }
        case 'output': {
          outputs += 1;
          const amount = rule.ops.reduce((sum, op) => sum + (op.count ?? 1), 0) || 1;
          push(rule, 'output', zh
            ? `向 ${locationText(rule)} 推送 ${amount} 个物品`
            : `Insert ${amount} item(s) into ${locationText(rule)}`, amount);
          break;
        }
        case 'if': {
          push(rule, 'if', zh
            ? `检查条件 ${exprToText(rule.condition)}`
            : `Check condition ${exprToText(rule.condition)}`);
          if (rule.then.length) {
            push(rule, 'info', zh ? '条件成立 → 执行 then 分支' : 'Condition true → run then branch');
            walk(rule.then);
          }
          rule.elifs.forEach((clause) => {
            push(rule, 'info', zh
              ? `否则检查 ${exprToText(clause.condition)}`
              : `Else check ${exprToText(clause.condition)}`);
            walk(clause.body);
          });
          if (rule.else.length) {
            push(rule, 'info', zh ? '条件不成立 → 执行 else 分支' : 'Condition false → run else branch');
            walk(rule.else);
          }
          break;
        }
        case 'forget':
          push(rule, 'info', zh
            ? `清空 ${labelsToText(rule.labels) || '全部'} 的输入缓存`
            : `Forget cached inputs for ${labelsToText(rule.labels) || 'all labels'}`);
          break;
        default:
          break;
      }
    }
  };

  walk(rules);

  if (!events.length) {
    warnings.push(zh ? '没有可执行的规则' : 'No executable rules');
  }

  return { events, totalTicks: tick, inputs, outputs, warnings };
}
