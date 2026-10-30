import type { AiSettings, Locale, Rule } from '../core/types';
import { hasErrors, parseProgram } from '../core/parser';
import { normalizeRules } from '../core/store/io';

export interface AiRequest {
  prompt: string;
  settings: AiSettings;
  knownTags: string[];
  locale: Locale;
}

export interface AiResponse {
  name: string | null;
  code: string;
  rules: Rule[];
  raw: string;
}

const SYSTEM_PROMPT = `You are an SFM (Super Factory Manager) script generator for Minecraft.
Return ONLY a compact JSON object: {"name":"<short program name>","code":"<SFM script>"}. No markdown fences, no commentary.

Official SFM syntax (use only this syntax, never invent keywords):
  name "Program name"
  every [?] [global|g] [+ offset] (ticks|tick|seconds|second) do ... end
  every redstone pulse do ... end
  (input|output) [[<count> [each]] [retain <keep> [each]] [<resource>]]* [except <resource>*] (from|to) [empty (slots|slot) in] [each] <label>* [round robin by (label|block)] [<side>* side] [(slots|slot) <range>*]
  if <boolexpr> then ... [else if <boolexpr> then ...]* [else ...] end
  forget [<label>*]
  -- single line comment

Details:
- Labels are label-gun names or quoted strings: "ores", "原料"; separate multiple labels with commas.
- Resource ids: minecraft:iron_ingot, or typed: fe::, gas::, fluid::, redstone::; regex allowed like "*_ingot".
- Sides: top, bottom, north, south, east, west; multiple sides like "top, bottom side"; "each side" for all sides; omit for none.
- Boolexpr: true/false, not, and, or, parentheses; "[every|each|some|one|lone|overall] <label>* [<side>* side] [slots <range>*] has (<gt|lt|eq|le|ge|>|<|=|<=|>=) <number> [<resource>]"; redstone [<cmp> <number>].
- Slot ranges: "slots 0-5", "slot 3", "slots 1,3-5".
- Counts: "input 8 iron_ingot from a", "output to b", "retain 16 each".

Rules:
- Indent nested rules with 2 spaces.
- Prefer labels when the user mentions a group of containers.
- Never invent sides or keywords outside the list above.
- Keep the program under 10 rules.`;


function errorText(text: string, status: number): string {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // ignore
  }
  return `HTTP ${status}: ${text.slice(0, 200)}`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next
    }
  }
  return null;
}

export async function generateRulesFromPrompt(request: AiRequest): Promise<AiResponse> {
  const { settings, prompt, knownTags, locale } = request;
  const zh = locale === 'zh';
  if (!settings.apiKey.trim()) {
    throw new Error(zh ? '请先在设置中填写 API Key' : 'Set an API key in settings first');
  }
  if (!settings.baseUrl.trim()) {
    throw new Error(zh ? '请先填写 Base URL' : 'Set a Base URL first');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const tagLine = knownTags.length ? `Known tags: ${knownTags.join(', ')}` : 'No tags defined yet.';

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: settings.model || 'deepseek-chat',
        temperature: 0.2,
        max_tokens: 1600,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${prompt}\n\n${tagLine}\nRespond with JSON only.`,
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(zh ? '请求超时，请检查网络或接口地址' : 'Request timed out; check network or endpoint');
    }
    throw new Error(zh
      ? `网络请求失败：${error instanceof Error ? error.message : String(error)}`
      : `Network error: ${error instanceof Error ? error.message : String(error)}`);
  }
  clearTimeout(timeout);

  const text = await response.text();
  if (!response.ok) throw new Error(errorText(text, response.status));

  const payload = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? '';
  if (!content.trim()) {
    throw new Error(zh ? '接口返回了空内容' : 'The API returned an empty response');
  }

  const parsed = extractJson(content);
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name : null;
    if (typeof record.code === 'string' && record.code.trim()) {
      const result = parseProgram(record.code, { knownTags });
      if (!hasErrors(result.diagnostics) && result.rules.length) {
        return { name: name ?? result.programName, code: record.code, rules: result.rules, raw: content };
      }
      const message = result.diagnostics.find((d) => d.severity === 'error')?.message;
      throw new Error(zh
        ? `AI 生成的代码无法解析${message ? `：${message}` : ''}`
        : `AI returned unparsable code${message ? `: ${message}` : ''}`);
    }
    if (Array.isArray(record.rules)) {
      const rules = normalizeRules(record.rules);
      if (rules.length) {
        return { name, code: '', rules, raw: content };
      }
    }
  }

  // 兜底：把返回文本当作纯 SFM 代码
  const fallback = parseProgram(content, { knownTags });
  if (!hasErrors(fallback.diagnostics) && fallback.rules.length) {
    return { name: fallback.programName, code: content, rules: fallback.rules, raw: content };
  }

  throw new Error(zh ? 'AI 没有返回可用的规则' : 'AI returned no usable rules');
}
