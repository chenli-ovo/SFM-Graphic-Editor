import {
  type BoolExpr,
  type CompareOp,
  type Diagnostic,
  type ElseIfClause,
  type EveryRule,
  type ForgetRule,
  type HasExpr,
  type IfRule,
  type InputRule,
  type IoOp,
  type Locale,
  type OutputRule,
  type PulseRule,
  type QuickFix,
  type Rule,
  type SetOp,
  type Severity,
  type Side,
  type SideSpec,
  type TimeUnit,
} from '../types';
import { SIDES as ALL_SIDES } from '../types';
import { newId } from '../../lib/id';

/* ------------------------------------------------------------------ */
/* 诊断文案                                                            */
/* ------------------------------------------------------------------ */

const MESSAGES: Record<Locale, Record<string, string>> = {
  zh: {
    missingInterval: '请填写执行间隔（正整数）',
    badEvery: 'every 语法应为：every [数字] [g] [+ 偏移] ticks|seconds do',
    badCondition: '条件表达式无法解析',
    emptyCondition: 'if 条件不能为空',
    missingLabel: '请填写标签（input/output 至少需要一个标签）',
    undefinedTag: '标签 “{tag}” 未定义，可一键创建',
    badSlots: '槽位格式无效，应形如 0-5, 8',
    missingAmount: '请填写数量',
    badLine: '无法解析该语句',
    extraEnd: '多余的 end：没有匹配的规则块',
    missingDo: 'every 语句缺少 do',
    missingThen: 'if 语句缺少 then',
    missingEnd: '缺少 end：{kind} 块没有闭合',
    badElse: 'else 只能出现在 if 块内',
    nameSyntax: 'name 语法应为：name "名称"',
    missingSource: '缺少输入位置，应形如 input from <标签> [top side]',
    missingDest: '缺少输出位置，应形如 output to <标签> [top side]',
    badSide: '无效朝向：{side}',
    badCompare: '无效比较符',
    badNumber: '这里需要数字',
  },
  en: {
    missingInterval: 'Interval is required (positive integer)',
    badEvery: 'Expected: every [number] [g] [+ offset] ticks|seconds do',
    badCondition: 'Cannot parse the condition expression',
    emptyCondition: 'if condition cannot be empty',
    missingLabel: 'A label is required for input/output',
    undefinedTag: 'Label “{tag}” is undefined — create it with one click',
    badSlots: 'Invalid slots, expected something like 0-5, 8',
    missingAmount: 'Amount is required',
    badLine: 'Cannot parse this statement',
    extraEnd: 'Unexpected end: no matching block',
    missingDo: 'every statement is missing do',
    missingThen: 'if statement is missing then',
    missingEnd: 'Missing end: {kind} block is not closed',
    badElse: 'else must be inside an if block',
    nameSyntax: 'Expected: name "program name"',
    missingSource: 'Missing input location, expected input from <label> [top side]',
    missingDest: 'Missing output location, expected output to <label> [top side]',
    badSide: 'Invalid side: {side}',
    badCompare: 'Invalid comparison operator',
    badNumber: 'A number is required here',
  },
};

function m(locale: Locale, key: string, params: Record<string, string> = {}): string {
  const template = MESSAGES[locale][key] ?? MESSAGES.zh[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');
}

/* ------------------------------------------------------------------ */
/* 公共类型                                                            */
/* ------------------------------------------------------------------ */

export interface ParseOptions {
  knownTags?: Iterable<string>;
  previousRules?: Rule[];
  locale?: Locale;
}

export interface ParseResult {
  programName: string | null;
  rules: Rule[];
  diagnostics: Diagnostic[];
  lineToRule: Record<number, string>;
  ruleLines: Record<string, { start: number; end: number }>;
  tagRefs: string[];
}

/* ------------------------------------------------------------------ */
/* 词法                                                                */
/* ------------------------------------------------------------------ */

interface Token {
  type: 'word' | 'string' | 'punct';
  value: string;
  raw: string;
  start: number;
  end: number;
  line: number;
}

const PUNCT_CHARS = new Set(['(', ')', ',', '>', '<']);

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  const n = code.length;

  const push = (type: Token['type'], value: string, raw: string, start: number, end: number) => {
    tokens.push({ type, value, raw, start, end, line });
  };

  while (i < n) {
    const ch = code[i];
    if (ch === '\n') {
      line += 1;
      i += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '-' && code[i + 1] === '-') {
      while (i < n && code[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '"') {
      const start = i;
      i += 1;
      let value = '';
      while (i < n) {
        const cur = code[i];
        if (cur === '\\' && i + 1 < n) {
          value += code[i + 1];
          i += 2;
          continue;
        }
        if (cur === '"') {
          i += 1;
          break;
        }
        if (cur === '\n') line += 1;
        value += cur;
        i += 1;
      }
      push('string', value, code.slice(start, i), start, i);
      continue;
    }
    if (ch === '>' || ch === '<') {
      if (code[i + 1] === '=') {
        push('punct', `${ch}=`, `${ch}=`, i, i + 2);
        i += 2;
      } else {
        push('punct', ch, ch, i, i + 1);
        i += 1;
      }
      continue;
    }
    if (ch === '=') {
      push('punct', '=', '=', i, i + 1);
      i += 1;
      continue;
    }
    if (ch === '(' || ch === ')' || ch === ',') {
      push('punct', ch, ch, i, i + 1);
      i += 1;
      continue;
    }
    const start = i;
    while (i < n) {
      const cur = code[i];
      if (cur === ' ' || cur === '\t' || cur === '\r' || cur === '\n' || cur === '"' || PUNCT_CHARS.has(cur)) break;
      if (cur === '-' && code[i + 1] === '-') break;
      i += 1;
    }
    const raw = code.slice(start, i);
    if (!raw) {
      i += 1;
      continue;
    }
    push('word', raw, raw, start, i);
  }

  return tokens;
}

const SIDE_SET = new Set<string>(ALL_SIDES);
const SET_OP_SET = new Set<string>(['overall', 'every', 'each', 'some', 'one', 'lone']);
const COMPARE_WORD: Record<string, CompareOp> = { gt: 'gt', lt: 'lt', eq: 'eq', le: 'le', ge: 'ge' };
const COMPARE_PUNCT: Record<string, CompareOp> = { '>': 'gt', '<': 'lt', '=': 'eq', '>=': 'ge', '<=': 'le' };
const STATEMENT_START = new Set(['input', 'output', 'if', 'every', 'forget', 'name', 'from', 'to', 'end', 'else']);
const RESERVED = new Set([
  'from',
  'to',
  'except',
  'with',
  'without',
  'each',
  'retain',
  'slots',
  'slot',
  'round',
  'has',
  'side',
  'and',
  'or',
  'not',
  'do',
  'then',
  'else',
  'end',
  'label',
  'block',
  'by',
]);

/** 不能作为操作项起始的关键字（or 单独处理，用于连接资源） */
const OP_STOP = new Set([
  'from', 'to', 'except', 'with', 'without', 'slots', 'slot', 'round', 'has', 'side',
  'and', 'not', 'do', 'then', 'else', 'end', 'label', 'block', 'by',
  'input', 'output', 'if', 'every', 'forget', 'name', 'empty', 'in', 'true', 'false',
]);

function isNumber(value: string): boolean {
  return /^\d+$/.test(value);
}

type BlockOutcome = { outcome: 'end' | 'else' | 'eof'; endLine?: number };

/* ------------------------------------------------------------------ */
/* 解析器                                                              */
/* ------------------------------------------------------------------ */

class Parser {
  private tokens: Token[];
  private pos = 0;
  private diagnostics: Diagnostic[] = [];
  private lineToRule: Record<number, string> = {};
  private ruleLines: Record<string, { start: number; end: number }> = {};
  private tagRefs = new Set<string>();
  private knownTags: Set<string>;
  private locale: Locale;
  programName: string | null = null;

  constructor(code: string, options: ParseOptions) {
    this.tokens = tokenize(code);
    this.knownTags = new Set(options.knownTags ?? []);
    this.locale = options.locale ?? 'zh';
  }

  getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  getLineToRule(): Record<number, string> {
    return this.lineToRule;
  }

  getRuleLines(): Record<string, { start: number; end: number }> {
    return this.ruleLines;
  }

  getTagRefs(): string[] {
    return [...this.tagRefs];
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private next(): Token | undefined {
    const token = this.tokens[this.pos];
    if (token) this.pos += 1;
    return token;
  }

  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private isWord(value: string, offset = 0): boolean {
    const token = this.peek(offset);
    return Boolean(token && token.type === 'word' && token.value.toLowerCase() === value);
  }

  private diag(severity: Severity, message: string, token: Token | undefined, fix?: QuickFix): void {
    const start = token?.start ?? 0;
    const end = token?.end ?? start + 1;
    this.diagnostics.push({
      severity,
      message,
      from: start,
      to: Math.max(end, start + 1),
      line: token?.line ?? 1,
      fix,
    });
  }

  private register(rule: Rule, token: Token | undefined): void {
    if (!token) return;
    this.lineToRule[token.line] = rule.id;
    const existing = this.ruleLines[rule.id];
    this.ruleLines[rule.id] = existing ?? { start: token.line, end: token.line };
  }

  /* ---------------- 标签 ---------------- */

  private readLabelToken(): { label: string; token: Token } | null {
    const token = this.peek();
    if (!token) return null;
    if (token.type === 'string') {
      this.next();
      return { label: token.value, token };
    }
    if (token.type === 'word') {
      const lower = token.value.toLowerCase();
      if (STATEMENT_START.has(lower) || RESERVED.has(lower) || SIDE_SET.has(lower)) return null;
      this.next();
      return { label: token.value, token };
    }
    return null;
  }

  private readLabels(): string[] {
    const labels: string[] = [];
    for (;;) {
      if (this.peek()?.value === ',') {
        this.next();
        continue;
      }
      const read = this.readLabelToken();
      if (!read) break;
      labels.push(read.label);
    }
    return labels;
  }

  private checkLabels(labels: string[], token: Token | undefined): void {
    if (labels.length === 0) {
      this.diag('error', m(this.locale, 'missingLabel'), token);
      return;
    }
    for (const label of labels) {
      if (label === '?') {
        this.diag('error', m(this.locale, 'missingLabel'), token);
        continue;
      }
      if (!this.knownTags.has(label)) {
        this.tagRefs.add(label);
        this.diag('warning', m(this.locale, 'undefinedTag', { tag: label }), token, {
          kind: 'define-tag',
          tagName: label,
        });
      }
    }
  }

  /* ---------------- side / slots ---------------- */

  private readSideSpec(): SideSpec {
    if (this.isWord('each') && this.isWord('side', 1)) {
      this.next();
      this.next();
      return { mode: 'each', sides: [] };
    }
    const sides: Side[] = [];
    for (;;) {
      const token = this.peek();
      if (!token || token.type !== 'word') break;
      const lower = token.value.toLowerCase();
      if (lower === 'side') break;
      if (!SIDE_SET.has(lower)) break;
      this.next();
      sides.push(lower as Side);
      if (this.peek()?.value === ',') this.next();
    }
    if (this.isWord('side')) this.next();
    return sides.length > 0 ? { mode: 'list', sides } : { mode: 'none', sides: [] };
  }

  private readSlots(): string {
    if (!this.isWord('slots') && !this.isWord('slot')) return '';
    this.next();
    const parts: string[] = [];
    while (!this.atEnd()) {
      const token = this.peek();
      if (!token) break;
      if (token.type === 'punct' && token.value === ',') {
        this.next();
        continue;
      }
      if (token.type === 'word' && (isNumber(token.value) || /^\d+-\d+$/.test(token.value))) {
        parts.push(token.value);
        this.next();
        continue;
      }
      break;
    }
    return parts.join(', ');
  }

  /* ---------------- 顶层 ---------------- */

  parseProgram(): Rule[] {
    const rules: Rule[] = [];
    const result = this.parseBlockInto(rules, false);
    if (result.outcome === 'end') {
      this.diag('error', m(this.locale, 'extraEnd'), undefined);
    }
    return rules;
  }

  private parseBlockInto(sink: Rule[], inBlock: boolean): BlockOutcome {
    for (;;) {
      const token = this.peek();
      if (!token) {
        if (inBlock) {
          this.diag('error', m(this.locale, 'missingEnd', { kind: 'block' }), token);
        }
        return { outcome: 'eof' };
      }
      const lower = token.type === 'word' ? token.value.toLowerCase() : '';

      if (lower === 'end') {
        this.next();
        return { outcome: 'end', endLine: token.line };
      }
      if (lower === 'else') {
        this.next();
        return { outcome: 'else', endLine: token.line };
      }
      if (lower === 'name') {
        this.next();
        const value = this.peek();
        if (value && (value.type === 'string' || value.type === 'word')) {
          this.next();
          this.programName = value.value;
        } else {
          this.diag('error', m(this.locale, 'nameSyntax'), token);
        }
        continue;
      }
      if (lower === 'every') {
        const rule = this.parseEvery(token);
        if (rule) {
          sink.push(rule);
          this.register(rule, token);
        }
        continue;
      }
      if (lower === 'if') {
        const rule = this.parseIf(token);
        if (rule) {
          sink.push(rule);
          this.register(rule, token);
        }
        continue;
      }
      if (lower === 'input' || lower === 'output' || lower === 'from' || lower === 'to') {
        const rule = this.parseIo(token);
        if (rule) {
          sink.push(rule);
          this.register(rule, token);
        }
        continue;
      }
      if (lower === 'forget') {
        this.next();
        const labels = this.readLabels();
        const rule: ForgetRule = { id: newId('rule'), type: 'forget', collapsed: false, note: '', labels };
        sink.push(rule);
        this.register(rule, token);
        continue;
      }
      this.diag('error', m(this.locale, 'badLine'), token);
      this.next();
    }
  }

  private parseEvery(start: Token): Rule | null {
    this.next(); // every

    if (this.isWord('redstone')) {
      this.next();
      if (this.isWord('pulse')) this.next();
      if (!this.isWord('do')) {
        this.diag('error', m(this.locale, 'missingDo'), this.peek() ?? start);
        return null;
      }
      this.next();
      const rule: PulseRule = { id: newId('rule'), type: 'pulse', collapsed: false, note: '', body: [] };
      const result = this.parseBlockInto(rule.body, true);
      this.ruleLines[rule.id] = { start: start.line, end: result.endLine ?? start.line };
      return rule;
    }

    let interval: number | null = null;
    let global = false;
    let offset: number | null = null;
    let unit: TimeUnit | null = null;

    const first = this.peek();
    if (first && first.type === 'word') {
      const numeric = first.value.replace(/^\+\s*/, '');
      if (isNumber(numeric)) {
        interval = Number(numeric);
        this.next();
      }
    }
    if (this.isWord('g') || this.isWord('global')) {
      global = true;
      this.next();
    }
    const plus = this.peek();
    if (plus && plus.type === 'word' && (plus.value === '+' || plus.value.startsWith('+'))) {
      this.next();
      const raw = plus.value.replace(/^\+/, '');
      if (isNumber(raw)) offset = Number(raw);
      else {
        const value = this.peek();
        if (value && value.type === 'word' && isNumber(value.value)) {
          offset = Number(value.value);
          this.next();
        }
      }
    }
    if (this.isWord('ticks') || this.isWord('tick')) {
      unit = 'ticks';
      this.next();
    } else if (this.isWord('seconds') || this.isWord('second')) {
      unit = 'seconds';
      this.next();
    }

    if (unit === null) {
      this.diag('error', m(this.locale, 'badEvery'), this.peek() ?? start);
      return null;
    }
    if (!this.isWord('do')) {
      this.diag('error', m(this.locale, 'missingDo'), this.peek() ?? start);
      return null;
    }
    this.next();

    if (interval === null) {
      this.diag('error', m(this.locale, 'missingInterval'), first ?? start);
    }

    const rule: EveryRule = {
      id: newId('rule'),
      type: 'every',
      collapsed: false,
      note: '',
      interval,
      global,
      offset,
      unit,
      body: [],
    };
    const result = this.parseBlockInto(rule.body, true);
    if (result.outcome === 'else') {
      this.diag('error', m(this.locale, 'badElse'), start);
    }
    this.ruleLines[rule.id] = { start: start.line, end: result.endLine ?? start.line };
    return rule;
  }

  private parseIf(start: Token): IfRule | null {
    this.next(); // if
    const condition = this.parseExpr();
    if (!condition) {
      this.diag('error', m(this.locale, 'emptyCondition'), this.peek() ?? start);
      return null;
    }
    if (!this.isWord('then')) {
      this.diag('error', m(this.locale, 'missingThen'), this.peek() ?? start);
      return null;
    }
    this.next();

    const rule: IfRule = {
      id: newId('rule'),
      type: 'if',
      collapsed: false,
      note: '',
      condition,
      then: [],
      elifs: [],
      else: [],
    };

    let result = this.parseBlockInto(rule.then, true);
    while (result.outcome === 'else') {
      if (this.isWord('if')) {
        this.next();
        const elifCondition = this.parseExpr();
        if (!elifCondition) {
          this.diag('error', m(this.locale, 'emptyCondition'), this.peek() ?? start);
          break;
        }
        if (!this.isWord('then')) {
          this.diag('error', m(this.locale, 'missingThen'), this.peek() ?? start);
          break;
        }
        this.next();
        const clause: ElseIfClause = { id: newId('elif'), condition: elifCondition, body: [] };
        rule.elifs.push(clause);
        result = this.parseBlockInto(clause.body, true);
      } else {
        result = this.parseBlockInto(rule.else, true);
        break;
      }
    }
    this.ruleLines[rule.id] = { start: start.line, end: result.endLine ?? start.line };
    return rule;
  }

  /* ---------------- input / output ---------------- */

  private parseIo(start: Token): InputRule | OutputRule | null {
    const first = this.next()!;
    const firstLower = first.value.toLowerCase();
    const reversed = firstLower === 'from' || firstLower === 'to';

    let location: IoLocation;
    let keyword: 'input' | 'output';

    if (reversed) {
      location = this.parseIoLocation(start);
      if (!this.isWord('input') && !this.isWord('output')) {
        this.diag('error', m(this.locale, 'badLine'), this.peek() ?? start);
        return null;
      }
      keyword = (this.next()!.value.toLowerCase() as 'input' | 'output');
    } else {
      keyword = firstLower as 'input' | 'output';
      const prefix = this.parseIoPrefix();
      if (!this.isWord('from') && !this.isWord('to')) {
        this.diag('error', m(this.locale, keyword === 'input' ? 'missingSource' : 'missingDest'), this.peek() ?? start);
        return null;
      }
      this.next();
      location = this.parseIoLocation(start);
      return this.buildIo(keyword, prefix, location, start);
    }

    const prefix = this.parseIoPrefix();
    return this.buildIo(keyword, prefix, location, start);
  }

  private buildIo(
    keyword: 'input' | 'output',
    prefix: { ops: IoOp[]; except: string[] },
    location: IoLocation,
    start: Token,
  ): InputRule | OutputRule {
    const base = {
      id: newId('rule'),
      collapsed: false,
      note: '',
      ops: prefix.ops,
      except: prefix.except,
      labels: location.labels,
      each: location.each,
      roundRobin: location.roundRobin,
      sides: location.sides,
      slots: location.slots,
    };
    const rule: InputRule | OutputRule =
      keyword === 'output'
        ? { ...base, type: 'output', emptySlotsIn: location.emptySlotsIn }
        : { ...base, type: 'input' };
    this.ruleLines[rule.id] = { start: start.line, end: start.line };
    return rule;
  }

  private parseIoPrefix(): { ops: IoOp[]; except: string[] } {
    const ops: IoOp[] = [];
    const except: string[] = [];
    while (!this.atEnd() && !this.isWord('from') && !this.isWord('to')) {
      const token = this.peek()!;
      if (token.type === 'punct' && token.value === ',') {
        this.next();
        continue;
      }
      const lower = token.type === 'word' ? token.value.toLowerCase() : '';
      if (lower === 'except') {
        this.next();
        while (!this.atEnd() && !this.isWord('from') && !this.isWord('to')) {
          const entry = this.peek();
          if (!entry) break;
          if (entry.type === 'punct' && entry.value === ',') {
            this.next();
            continue;
          }
          if (entry.type !== 'word' && entry.type !== 'string') break;
          const entryLower = entry.value.toLowerCase();
          if (isNumber(entry.value) || ['retain', 'each', 'except'].includes(entryLower)) break;
          except.push(entry.type === 'string' ? `"${entry.value}"` : entry.value);
          this.next();
        }
        continue;
      }
      const op = this.parseOp();
      if (!op) break;
      ops.push(op);
    }
    return { ops, except };
  }

  private parseOp(): IoOp | null {
    const token = this.peek();
    if (!token) return null;
    if (token.type !== 'word' && token.type !== 'string') return null;
    const lower = token.type === 'word' ? token.value.toLowerCase() : '';
    if (OP_STOP.has(lower)) return null;

    const op: IoOp = {
      count: null,
      countEach: false,
      retain: null,
      retainEach: false,
      resource: '',
      withClause: null,
      withoutClause: null,
    };
    let touched = false;

    if (token.type === 'word' && isNumber(token.value)) {
      op.count = Number(token.value);
      this.next();
      touched = true;
      if (this.isWord('each')) {
        op.countEach = true;
        this.next();
      }
    }

    if (this.isWord('retain')) {
      this.next();
      const value = this.peek();
      if (value && value.type === 'word' && isNumber(value.value)) {
        op.retain = Number(value.value);
        this.next();
        touched = true;
        if (this.isWord('each')) {
          op.retainEach = true;
          this.next();
        }
      }
    }

    const res = this.peek();
    if (res && (res.type === 'word' || res.type === 'string') && !OP_STOP.has(res.value.toLowerCase())) {
      op.resource = res.type === 'string' ? `"${res.value}"` : res.value;
      this.next();
      touched = true;
      while (this.isWord('or')) {
        this.next();
        const nextRes = this.peek();
        if (!nextRes || (nextRes.type !== 'word' && nextRes.type !== 'string')) break;
        const nextLower = nextRes.value.toLowerCase();
        if (OP_STOP.has(nextLower)) break;
        op.resource += ` or ${nextRes.type === 'string' ? `"${nextRes.value}"` : nextRes.value}`;
        this.next();
      }
    }

    if (this.isWord('with') || this.isWord('without')) {
      const keyword = this.next()!;
      const clause = this.readClause();
      if (keyword.value.toLowerCase() === 'with') op.withClause = clause;
      else op.withoutClause = clause;
      touched = true;
    }

    return touched ? op : null;
  }

  private parseIoLocation(start: Token): IoLocation {
    let emptySlotsIn = false;
    if (this.isWord('empty') && (this.isWord('slots', 1) || this.isWord('slot', 1))) {
      this.next();
      this.next();
      if (this.isWord('in')) this.next();
      emptySlotsIn = true;
    }
    let each = false;
    if (this.isWord('each')) {
      each = true;
      this.next();
    }
    const labelsToken = this.peek();
    const labels = this.readLabels();
    this.checkLabels(labels, labelsToken ?? start);

    let roundRobin: 'label' | 'block' | null = null;
    if (this.isWord('round') && this.isWord('robin', 1)) {
      this.next();
      this.next();
      if (this.isWord('by')) this.next();
      if (this.isWord('label')) {
        roundRobin = 'label';
        this.next();
      } else if (this.isWord('block')) {
        roundRobin = 'block';
        this.next();
      }
    }

    const sides = this.readSideSpec();
    const slots = this.readSlots();
    return { emptySlotsIn, each, labels, roundRobin, sides, slots };
  }

  /* ---------------- 条件表达式 ---------------- */

  parseExpr(): BoolExpr | null {
    return this.parseOr();
  }

  private parseOr(): BoolExpr | null {
    let left = this.parseAnd();
    if (!left) return null;
    while (this.isWord('or')) {
      this.next();
      const right = this.parseAnd();
      if (!right) break;
      left = { kind: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): BoolExpr | null {
    let left = this.parseNot();
    if (!left) return null;
    while (this.isWord('and')) {
      this.next();
      const right = this.parseNot();
      if (!right) break;
      left = { kind: 'and', left, right };
    }
    return left;
  }

  private parseNot(): BoolExpr | null {
    if (this.isWord('not')) {
      this.next();
      const expr = this.parseNot();
      return expr ? { kind: 'not', expr } : null;
    }
    return this.parseAtom();
  }

  private parseAtom(): BoolExpr | null {
    const token = this.peek();
    if (!token) return null;
    if (token.type === 'punct' && token.value === '(') {
      this.next();
      const expr = this.parseExpr();
      if (this.peek()?.value === ')') this.next();
      return expr;
    }
    const lower = token.type === 'word' ? token.value.toLowerCase() : '';
    if (lower === 'true') {
      this.next();
      return { kind: 'const', value: true };
    }
    if (lower === 'false') {
      this.next();
      return { kind: 'const', value: false };
    }
    if (lower === 'redstone') {
      this.next();
      const compareToken = this.peek();
      if (compareToken && (compareToken.type === 'punct' || COMPARE_WORD[compareToken.value.toLowerCase()])) {
        const op = this.readCompare();
        if (!op) {
          this.diag('error', m(this.locale, 'badCompare'), this.peek() ?? token);
          return { kind: 'redstone', op: null, value: null };
        }
        const value = this.readNumber();
        if (value === null) this.diag('error', m(this.locale, 'missingAmount'), this.peek() ?? token);
        return { kind: 'redstone', op, value };
      }
      return { kind: 'redstone', op: null, value: null };
    }
    if (lower === 'has') {
      this.diag('error', m(this.locale, 'missingLabel'), token);
      this.next();
      return null;
    }
    return this.parseHas(token);
  }

  private parseHas(start: Token): HasExpr | null {
    const token = this.peek();
    if (!token) return null;
    if (token.type !== 'word' && token.type !== 'string') return null;

    let setOp: SetOp = 'overall';
    if (token.type === 'word' && SET_OP_SET.has(token.value.toLowerCase())) {
      setOp = token.value.toLowerCase() as SetOp;
      this.next();
    }
    let each = false;
    if (this.isWord('each')) {
      each = true;
      this.next();
    }
    const labels = this.readLabels();
    this.checkLabels(labels, start);

    let roundRobin: 'label' | 'block' | null = null;
    if (this.isWord('round') && this.isWord('robin', 1)) {
      this.next();
      this.next();
      if (this.isWord('by')) this.next();
      if (this.isWord('label')) {
        roundRobin = 'label';
        this.next();
      } else if (this.isWord('block')) {
        roundRobin = 'block';
        this.next();
      }
    }

    const sides = this.readSideSpec();
    const slots = this.readSlots();

    if (!this.isWord('has')) {
      this.diag('error', m(this.locale, 'badCondition'), this.peek() ?? start);
      return null;
    }
    this.next();

    const op = this.readCompare();
    if (!op) {
      this.diag('error', m(this.locale, 'badCompare'), this.peek() ?? start);
      return null;
    }
    const value = this.readNumber();
    if (value === null) this.diag('warning', m(this.locale, 'missingAmount'), this.peek() ?? start);

    let resource = '';
    const res = this.peek();
    if (res && (res.type === 'word' || res.type === 'string')) {
      const resLower = res.value.toLowerCase();
      if (!RESERVED.has(resLower) && !STATEMENT_START.has(resLower)) {
        resource = res.type === 'string' ? `"${res.value}"` : res.value;
        this.next();
      }
    }

    let withClause: string | null = null;
    let withoutClause: string | null = null;
    for (;;) {
      if (this.isWord('with')) {
        this.next();
        withClause = this.readClause();
        continue;
      }
      if (this.isWord('without')) {
        this.next();
        withoutClause = this.readClause();
        continue;
      }
      break;
    }

    const except: string[] = [];
    if (this.isWord('except')) {
      this.next();
      while (!this.atEnd()) {
        const entry = this.peek()!;
        if (entry.type === 'punct' && entry.value === ',') {
          this.next();
          continue;
        }
        if (entry.type !== 'word' && entry.type !== 'string') break;
        if (STATEMENT_START.has(entry.value.toLowerCase())) break;
        except.push(entry.type === 'string' ? `"${entry.value}"` : entry.value);
        this.next();
      }
    }

    return {
      kind: 'has',
      setOp,
      labels,
      each,
      roundRobin,
      sides,
      slots,
      op,
      value,
      resource,
      withClause,
      withoutClause,
      except,
    };
  }

  private readClause(): string {
    const parts: string[] = [];
    let depth = 0;
    while (!this.atEnd()) {
      const token = this.peek()!;
      if (token.type === 'word' && depth === 0) {
        const lower = token.value.toLowerCase();
        if (STATEMENT_START.has(lower) || lower === 'except' || lower === 'with' || lower === 'without') break;
      }
      if (token.type === 'punct') {
        if (token.value === '(') depth += 1;
        if (token.value === ')') depth = Math.max(0, depth - 1);
      }
      parts.push(token.raw);
      this.next();
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  private readCompare(): CompareOp | null {
    const token = this.peek();
    if (!token) return null;
    if (token.type === 'punct' && COMPARE_PUNCT[token.value]) {
      this.next();
      return COMPARE_PUNCT[token.value];
    }
    if (token.type === 'word' && COMPARE_WORD[token.value.toLowerCase()]) {
      this.next();
      return COMPARE_WORD[token.value.toLowerCase()];
    }
    return null;
  }

  private readNumber(): number | null {
    const token = this.peek();
    if (!token) return null;
    if (token.type === 'word' && isNumber(token.value)) {
      this.next();
      return Number(token.value);
    }
    if (token.type === 'word' && token.value === '?') {
      this.next();
      return null;
    }
    return null;
  }
}

interface IoLocation {
  emptySlotsIn: boolean;
  each: boolean;
  labels: string[];
  roundRobin: 'label' | 'block' | null;
  sides: SideSpec;
  slots: string;
}

/* ------------------------------------------------------------------ */
/* 主入口                                                              */
/* ------------------------------------------------------------------ */

export function parseProgram(code: string, options: ParseOptions = {}): ParseResult {
  const parser = new Parser(code, options);
  const rules = parser.parseProgram();
  const diagnostics = parser.getDiagnostics().slice();

  const remap = new Map<string, string>();
  if (options.previousRules?.length && rules.length) {
    reconcileIds(rules, options.previousRules, remap);
  }

  const lineToRule: Record<number, string> = {};
  for (const [line, rid] of Object.entries(parser.getLineToRule())) {
    lineToRule[Number(line)] = remap.get(rid) ?? rid;
  }
  const ruleLines: Record<string, { start: number; end: number }> = {};
  for (const [rid, range] of Object.entries(parser.getRuleLines())) {
    ruleLines[remap.get(rid) ?? rid] = range;
  }

  diagnostics.sort((a, b) => a.from - b.from || a.severity.localeCompare(b.severity));

  return {
    programName: parser.programName,
    rules,
    diagnostics,
    lineToRule,
    ruleLines,
    tagRefs: parser.getTagRefs(),
  };
}

function reconcileIds(parsed: Rule[], previous: Rule[], remap: Map<string, string>): void {
  parsed.forEach((rule, index) => {
    const prev = previous[index];
    if (!prev || prev.type !== rule.type) return;
    remap.set(rule.id, prev.id);
    rule.id = prev.id;
    rule.collapsed = prev.collapsed;
    if (!rule.note && prev.note) rule.note = prev.note;
    if (rule.type === 'if' && prev.type === 'if') {
      reconcileIds(rule.then, prev.then, remap);
      rule.elifs.forEach((clause, clauseIndex) => {
        const prevClause = prev.elifs[clauseIndex];
        if (prevClause) reconcileIds(clause.body, prevClause.body, remap);
      });
      reconcileIds(rule.else, prev.else, remap);
    } else if ((rule.type === 'every' || rule.type === 'pulse') && (prev.type === 'every' || prev.type === 'pulse')) {
      reconcileIds(rule.body, prev.body, remap);
    }
  });
}

export function lintProgram(code: string, options: ParseOptions = {}): Diagnostic[] {
  return parseProgram(code, options).diagnostics;
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}

/** 把一段 boolexpr 原文解析成 AST（供表单条件编辑使用） */
export function parseExprText(text: string): BoolExpr | null {
  const parser = new Parser(text, {});
  const expr = parser.parseExpr();
  if (!expr) return null;
  if (!parser.atEnd()) return null;
  if (parser.getDiagnostics().some((entry) => entry.severity === 'error')) return null;
  return expr;
}
