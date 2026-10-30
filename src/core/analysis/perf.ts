import type { Locale, PerfReport, Rule } from '../types';

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function walkRules(rules: Rule[], visit: (rule: Rule) => void): void {
  for (const rule of rules) {
    visit(rule);
    if (rule.type === 'every' || rule.type === 'pulse') walkRules(rule.body, visit);
    if (rule.type === 'if') {
      walkRules(rule.then, visit);
      rule.elifs.forEach((clause) => walkRules(clause.body, visit));
      walkRules(rule.else, visit);
    }
  }
}

/** 每秒触发次数（估算） */
function triggerPerSecond(interval: number | null, unit: 'ticks' | 'seconds'): number {
  if (!interval || interval <= 0) return 20;
  if (unit === 'seconds') return Math.min(20, 1 / interval);
  return Math.min(20, 20 / interval);
}

export interface PerfOptions {
  cycleCount?: number;
}

export function analyzePerformance(rules: Rule[], locale: Locale, options: PerfOptions = {}): PerfReport {
  const zh = locale === 'zh';
  let totalRules = 0;
  let inputRules = 0;
  let outputRules = 0;
  let everyTickRules = 0;
  let peakTps = 0;
  let perTickLoad = 0;

  const topLevel = rules.length;

  const visit = (rule: Rule, frequency: number): void => {
    totalRules += 1;
    if (rule.type === 'input') {
      inputRules += 1;
      peakTps += frequency;
    } else if (rule.type === 'output') {
      outputRules += 1;
    } else if (rule.type === 'every') {
      const interval = rule.interval;
      const isEveryTick = rule.unit === 'ticks' && interval !== null && interval <= 1;
      if (isEveryTick) everyTickRules += 1;
      const f = triggerPerSecond(interval, rule.unit);
      if (isEveryTick) perTickLoad += 1;
      walkRules(rule.body, (child) => visit(child, f));
    } else if (rule.type === 'pulse') {
      walkRules(rule.body, (child) => visit(child, 1));
    } else if (rule.type === 'if') {
      walkRules(rule.then, (child) => visit(child, frequency));
      rule.elifs.forEach((clause) => walkRules(clause.body, (child) => visit(child, frequency)));
      walkRules(rule.else, (child) => visit(child, frequency));
    }
  };

  for (const rule of rules) visit(rule, 20);

  // 顶层 input/output 每 tick 都会执行
  perTickLoad += topLevel;

  const warnings: string[] = [];
  if (everyTickRules > 0) {
    warnings.push(zh
      ? `存在 ${everyTickRules} 条 EVERY TICK 规则，每 tick 执行可能造成服务器卡顿`
      : `${everyTickRules} EVERY TICK rules — running them every tick may lag the server`);
  }
  if (inputRules !== outputRules) {
    warnings.push(zh
      ? `输入与输出数量不配平：输入 ${inputRules}，输出 ${outputRules}`
      : `Inputs and outputs are unbalanced: ${inputRules} inputs, ${outputRules} outputs`);
  }
  if (options.cycleCount && options.cycleCount > 0) {
    warnings.push(zh
      ? `存在 ${options.cycleCount} 处循环依赖`
      : `${options.cycleCount} circular dependencies detected`);
  }
  if (totalRules > 40) {
    warnings.push(zh
      ? `规则数量较多（${totalRules}），建议拆分模块化程序`
      : `Many rules (${totalRules}); consider splitting into modules`);
  }

  const complexity = clamp((totalRules / 80) * 100);
  const stability = clamp(100 - everyTickRules * 14 - (options.cycleCount ?? 0) * 18 - Math.max(0, totalRules - 40) * 1.5);
  const balance = clamp(100 - Math.abs(inputRules - outputRules) * 14);
  const speed = clamp((peakTps / 120) * 100);
  const efficiency = clamp(100 - perTickLoad * 6);

  const score = Math.round(speed * 0.2 + stability * 0.3 + (100 - complexity) * 0.2 + balance * 0.2 + efficiency * 0.1);

  return {
    score: clamp(score),
    peakTps: Math.round(peakTps * 10) / 10,
    ticksPerSecond: 20,
    totalRules,
    everyTickRules,
    warnings,
    metrics: [
      { label: 'speed', value: Math.round(speed) },
      { label: 'stability', value: Math.round(stability) },
      { label: 'complexity', value: Math.round(complexity) },
      { label: 'balance', value: Math.round(balance) },
      { label: 'efficiency', value: Math.round(efficiency) },
    ],
  };
}
