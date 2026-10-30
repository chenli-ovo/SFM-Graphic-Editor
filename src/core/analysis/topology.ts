import type { DeadlockWarning, FlowEdge, FlowNode, Locale, Rule, Tag, TopologyData } from '../types';

export interface TopologyResult {
  data: TopologyData;
  warnings: DeadlockWarning[];
}

interface Location {
  key: string;
  label: string;
  kind: FlowNode['kind'];
  color: string;
}

interface Usage {
  ruleId: string;
  ruleType: Rule['type'];
  locations: Location[];
}

const LABEL_COLOR = '#34d399';
const SIDE_COLOR = '#60a5fa';
const TAG_COLOR = '#34d399';

function locationsOf(rule: Rule, tagByName: Map<string, Tag>): Location[] {
  if (rule.type !== 'input' && rule.type !== 'output') return [];
  const labels = rule.labels.filter((label) => label.trim() && label.trim() !== '?');
  const sides = rule.sides.mode === 'each' ? ['each'] : rule.sides.mode === 'list' ? rule.sides.sides : [];
  const out: Location[] = [];
  if (labels.length) {
    for (const label of labels) {
      const tag = tagByName.get(label);
      for (const side of sides.length ? sides : ['']) {
        out.push({
          key: `label:${label}${side ? `:${side}` : ''}`,
          label: side ? `${label} · ${side.toUpperCase()}` : label,
          kind: 'label',
          color: tag?.color ?? LABEL_COLOR,
        });
      }
    }
    return out;
  }
  for (const side of sides) {
    out.push({
      key: `side:${side}`,
      label: side === 'each' ? 'EACH SIDE' : side.toUpperCase(),
      kind: 'side',
      color: SIDE_COLOR,
    });
  }
  return out;
}

/** 把规则树按作用域切开：顶层、every/pulse body、if 各分支 */
function collectScopes(rules: Rule[], out: Usage[][]): void {
  const scope: Usage[] = [];
  for (const rule of rules) {
    if (rule.type === 'input' || rule.type === 'output') {
      const locations = locationsOf(rule, new Map());
      if (locations.length) scope.push({ ruleId: rule.id, ruleType: rule.type, locations });
    } else if (rule.type === 'every' || rule.type === 'pulse') {
      collectScopes(rule.body, out);
    } else if (rule.type === 'if') {
      collectScopes(rule.then, out);
      rule.elifs.forEach((clause) => collectScopes(clause.body, out));
      collectScopes(rule.else, out);
    }
  }
  if (scope.length) out.push(scope);
}

function detectCycles(nodes: FlowNode[], edges: FlowEdge[]): Array<{ path: string[]; ruleIds: string[] }> {
  const adjacency = new Map<string, FlowEdge[]>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const list = adjacency.get(edge.from);
    if (list) list.push(edge);
    else adjacency.set(edge.from, [edge]);
  }

  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const found: Array<{ path: string[]; ruleIds: string[] }> = [];
  const seenKey = new Set<string>();

  const visit = (nodeId: string): void => {
    state.set(nodeId, 1);
    stack.push(nodeId);
    for (const edge of adjacency.get(nodeId) ?? []) {
      const next = edge.to;
      const nextState = state.get(next) ?? 0;
      if (nextState === 0) {
        visit(next);
      } else if (nextState === 1) {
        const start = stack.indexOf(next);
        if (start >= 0) {
          const path = stack.slice(start);
          const key = [...path].sort().join('|');
          if (!seenKey.has(key) && found.length < 6) {
            seenKey.add(key);
            const ruleIds: string[] = [];
            for (let i = 0; i < path.length; i += 1) {
              const from = path[i];
              const to = path[(i + 1) % path.length];
              const match = edges.find((e) => e.from === from && e.to === to);
              if (match) ruleIds.push(match.ruleId);
            }
            found.push({ path, ruleIds });
          }
        }
      }
    }
    stack.pop();
    state.set(nodeId, 2);
  };

  for (const node of nodes) {
    if ((state.get(node.id) ?? 0) === 0) visit(node.id);
  }
  return found;
}

export function analyzeTopology(rules: Rule[], tags: Tag[], locale: Locale): TopologyResult {
  const tagByName = new Map(tags.map((tag) => [tag.name, tag]));
  const scopes: Usage[][] = [];
  collectScopes(rules, scopes);

  const nodeMap = new Map<string, FlowNode>();
  const edgeMap = new Map<string, FlowEdge>();
  let inputCount = 0;
  let outputCount = 0;
  let everyTick = 0;

  const walkForCounts = (list: Rule[]): void => {
    for (const rule of list) {
      if (rule.type === 'input') inputCount += 1;
      if (rule.type === 'output') outputCount += 1;
      if (rule.type === 'every' && rule.unit === 'ticks' && rule.interval !== null && rule.interval <= 1) {
        everyTick += 1;
      }
      if (rule.type === 'every' || rule.type === 'pulse') walkForCounts(rule.body);
      if (rule.type === 'if') {
        walkForCounts(rule.then);
        rule.elifs.forEach((clause) => walkForCounts(clause.body));
        walkForCounts(rule.else);
      }
    }
  };
  walkForCounts(rules);

  for (const scope of scopes) {
    const inputs = scope.filter((usage) => usage.ruleType === 'input');
    const outputs = scope.filter((usage) => usage.ruleType === 'output');
    if (!inputs.length || !outputs.length) continue;
    for (const input of inputs) {
      for (const from of input.locations) {
        const fromNode: FlowNode = {
          id: from.key,
          kind: from.kind,
          label: from.label,
          color: tagByName.get(from.label.split(' · ')[0])?.color ?? from.color,
        };
        nodeMap.set(fromNode.id, fromNode);
        for (const output of outputs) {
          for (const to of output.locations) {
            const toNode: FlowNode = {
              id: to.key,
              kind: to.kind,
              label: to.label,
              color: tagByName.get(to.label.split(' · ')[0])?.color ?? to.color,
            };
            nodeMap.set(toNode.id, toNode);
            if (fromNode.id === toNode.id) continue;
            const id = `${fromNode.id}->${toNode.id}:${input.ruleId}:${output.ruleId}`;
            if (edgeMap.has(id)) continue;
            edgeMap.set(id, {
              id,
              from: fromNode.id,
              to: toNode.id,
              label: 'items',
              ruleId: input.ruleId,
              ruleType: input.ruleType,
            });
            if (edgeMap.size > 240) break;
          }
          if (edgeMap.size > 240) break;
        }
      }
      if (edgeMap.size > 240) break;
    }
  }

  const nodes = [...nodeMap.values()];
  const edges = [...edgeMap.values()];
  const warnings: DeadlockWarning[] = [];
  const zh = locale === 'zh';

  for (const cycle of detectCycles(nodes, edges)) {
    const labels = cycle.path.map((id) => nodes.find((n) => n.id === id)?.label ?? id);
    warnings.push({
      kind: 'cycle',
      message: zh
        ? `${labels.join(' → ')} → ${labels[0]} 形成闭环，物品可能无法流转`
        : `${labels.join(' → ')} → ${labels[0]} closes a loop; items may never flow`,
      ruleIds: [...new Set(cycle.ruleIds)],
    });
  }

  if (inputCount !== outputCount) {
    warnings.push({
      kind: 'unbalanced',
      message: zh
        ? `输入与输出不配平：${inputCount} 条输入规则，${outputCount} 条输出规则`
        : `Inputs and outputs are unbalanced: ${inputCount} inputs, ${outputCount} outputs`,
      ruleIds: [],
    });
  }

  if (everyTick > 0) {
    warnings.push({
      kind: 'busy',
      message: zh
        ? `检测到 ${everyTick} 条每 tick 规则，可能造成服务器卡顿`
        : `${everyTick} every-tick rules detected; this may lag the server`,
      ruleIds: [],
    });
  }

  return { data: { nodes, edges }, warnings };
}

export function topologyColorFor(ruleType: Rule['type']): string {
  return ruleType === 'input' ? '#34d399' : ruleType === 'output' ? '#f472b6' : SIDE_COLOR;
}

export const TOPOLOGY_TAG_COLOR = TAG_COLOR;
