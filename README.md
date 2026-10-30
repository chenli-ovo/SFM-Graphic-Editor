# SFM Studio

> Minecraft **Super Factory Manager (SFM)** 可视化脚本生成器 —— 用表单搭规则，实时生成可直接进游戏的 `.sfm` 代码。

React 18 + TypeScript + Tailwind + Zustand + CodeMirror 6 构建，最终打包为**一个可双击运行的 `index.html`**（无后端、无 Node 依赖）。

---

## 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [单文件构建](#单文件构建)
- [界面与快捷键](#界面与快捷键)
- [规则类型](#规则类型)
- [SFM 语法速查](#sfm-语法速查)
- [项目结构](#项目结构)
- [数据与备份](#数据与备份)
- [分享链接与 /give](#分享链接与-give)
- [AI 助手](#ai-助手)
- [测试](#测试)
- [常见问题](#常见问题)

---

## 特性

### 规则编辑
- 六种规则：**定时执行**、**红石脉冲**、**输入 INPUT**、**输出 OUTPUT**、**条件判断 IF/ELSE IF/ELSE**、**FORGET**
- 规则卡片拖拽排序（原生 HTML5 拖拽，同层校验）、复制、删除、折叠、上下移动、备注
- 表单字段按规则类型动态渲染；输入/输出支持多操作项（数量、`each`、`retain`、资源 ID、`with/without`）、`except`、多朝向、`slots`、`round robin`、`empty slots in`
- 条件支持完整 boolexpr：`and / or / not / 括号 / has / redstone / setOp`

### 代码编辑（CodeMirror 6）
- 官方 SFM 语法高亮、行号、代码折叠、搜索、自动补全（标签 / 物品 / 朝向 / 关键字）
- **双向同步**：表单改动实时生成代码；代码合法时自动回填表单，非法时只报诊断、不覆盖表单
- Linter 诊断：字段缺失 → 红色波浪线；标签未定义 → 黄色波浪线，并可一键创建标签
- 行号旁点击设置**断点**，`Ctrl+S` 强制从代码同步回表单

### 可视化与调试
- **模拟运行**：逐行高亮 + 时间线日志（`[Tick n]` 抽取 / 传输 / 条件分支）
- **工厂拓扑图**：把标签、朝向解析成节点，自动连物品流向箭头，支持拖动节点与缩放
- **死锁 / 循环检测**：A→B→A 循环、输入输出不配平、每 Tick 高频触发，顶部红色/黄色告警
- **产能 / 性能估算**：峰值吞吐、TPS、每 Tick 负载、综合评分 + 雷达图

### 数据管理
- 多项目切换、重命名、删除
- 撤销 / 重做（`Ctrl+Z` / `Ctrl+Y`），历史快照保存与回滚（最多 30 份）
- 标签库（颜色、引用计数）、物品库（9 大类、自定义物品）、模板库（内置模板 + 自定义 + JSON 导入导出）
- 一键导出 `.sfm`、项目 JSON、全量备份包（项目 + 标签 + 物品 + 模板 + 主题 + 设置），支持恢复
- 所有数据保存在浏览器 **IndexedDB**（localforage），无需登录

### 界面
- 三种主题：深夜极客 / 日光工坊 / 赛博朋克；10 种强调色 + 自定义取色（CSS Variables 注入）
- 侧栏平滑折叠、全局 Tooltip、中英双语切换、命令面板（`Ctrl+K` / `F1`）、代码长图导出、可关闭的机械键盘音效

---

## 快速开始

需要 Node.js 18+（开发时使用 Node 24 验证）。

```bash
# 安装依赖
npm install

# 开发模式（http://localhost:5173）
npm run dev

# 类型检查
npm run typecheck

# 运行单元测试
npm run test
```

> Windows 下如果 npm 缓存目录不可写，可加 `--cache .npm-cache` 参数。

---

## 单文件构建

```bash
npm run build
```

产物为 `dist/index.html`，CSS、JavaScript、图标全部内联（`vite-plugin-singlefile`），**大小约 820 KiB**。

把 `dist/index.html` 直接发给朋友，双击即可在浏览器中使用——不需要 Node、不需要服务器、不需要联网（AI 助手与分享链接除外）。

> 如果构建时报 `esbuild` / 临时目录相关的 `Access is denied`，把 `TEMP`/`TMP` 指向项目内目录再构建：
>
> ```powershell
> $env:TEMP = "$PWD\.tmp"; $env:TMP = $env:TEMP; npm run build
> ```

---

## 界面与快捷键

| 区域 | 说明 |
| --- | --- |
| 顶部工具栏 | 项目切换、新建、撤销/重做、快照、模拟、拓扑、性能、AI、主题、语言、导出、分享、`/give`、设置 |
| 左侧栏 | 标签库 / 物品库 / 模板库 / 主题设置（可折叠） |
| 中间 | 规则卡片编辑区 |
| 右侧 | SFM 代码编辑器 + Minimap + 诊断 / 模拟 / 拓扑 / 性能面板 |

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+K` / `F1` | 打开命令面板 |
| `Ctrl+S` | 从代码强制同步到表单 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做 |
| `Ctrl+E` | 导出 `.sfm` |
| `Ctrl+Enter` | AI 弹窗内生成规则 |

---

## 规则类型

| 规则 | 生成语法（示例） |
| --- | --- |
| 定时执行 | `every 20 ticks do ... end`、`every 10 g + 5 seconds do ... end` |
| 红石脉冲 | `every redstone pulse do ... end` |
| 输入 | `input 8 each minecraft:iron_ingot from ores top side slots 0-5` |
| 输出 | `output 8 to furnace top side`、`output to empty slots in b` |
| 条件 | `if ores has > 64 then ... else if ... then ... else ... end` |
| FORGET | `forget ores` |

规则卡片支持嵌套：定时/脉冲/条件内部可以继续添加任意规则。

---

## SFM 语法速查

### 注释与程序名

```sfm
-- 单行注释
name "熔炼工厂"
```

### 触发器

```sfm
every 20 ticks do ... end
every 10 g + 5 seconds do ... end     -- 全局对齐 + 偏移 5 秒
every redstone pulse do ... end
```

- 单位：`tick` / `ticks` / `second` / `seconds`
- `g` / `global`：全局对齐；`+ n`：偏移
- 红石脉冲只支持 `every redstone pulse`（没有 `rising` / `falling` 之分）

### 输入 / 输出

```sfm
(input|output) [[数量 [each]] [retain 保留数 [each]] [resourceid]]*
  [except resourceid*]
  (from|to) [empty (slots|slot) in] [each] <标签>*
  [round robin by (label|block)] [<side>* side] [(slots|slot) <范围>*]
```

也支持倒装：`from a input 8 iron_ingot`、`to b output`。

- 标签：标签枪的标签名，可多值逗号分隔，也可用双引号（`"原料"`）
- 资源：`minecraft:iron_ingot`、`fe::`、`gas::`、`*_ingot`、`"(iron|gold)_ingot"`、`stone or dirt`
- 朝向：`top` `bottom` `north` `south` `east` `west` `left` `right` `front` `back`，可多值（`top, bottom side`）或 `each side`
- 槽位：`slots 1,3-5`、`slot 0`
- `empty slots in`：只输出到空槽位

### 条件

```sfm
if ores has > 64 then
  output to storage
else if ores has >= 32 and not redstone then
  output to hopper bottom side
else
  forget ores
end
```

- 支持 `true` / `false`、`not`、`and` / `or`、括号
- `has` 比较：`[every|each|some|one|lone|overall] <标签>* ... has <> >= n [resource] [with/without ...] [except ...]`
- 红石条件：`redstone`、`redstone > 0`
- 比较符：`>` `gt`、`<` `lt`、`=` `eq`、`<=` `le`、`>=` `ge`

### 其他

```sfm
forget ores
input fe:: from energy top side
output to "有机灌注器" top side
```

> 语义提醒：`input` 抽取的物品在 `output` 之后仍会保留在缓存中，需要时用 `forget` 清除。

---

## 项目结构

```text
sfm-studio/
├─ src/
│  ├─ core/
│  │  ├─ parser/          # DSL 解析 / 序列化（tokenizer + 递归下降）
│  │  ├─ rules/tree.ts    # 规则树工具（增删改、移动、遍历、复制）
│  │  ├─ store/           # Zustand 主 store、IndexedDB 持久化、导入导出校验
│  │  ├─ analysis/        # 拓扑 / 循环检测、性能估算
│  │  ├─ sim/             # 模拟器（时间线事件）
│  │  ├─ editor/          # CodeMirror：语言、补全、lint、断点、折叠、主题
│  │  └─ data/            # 默认项目、物品库、主题、内置模板
│  ├─ components/
│  │  ├─ RuleBuilder/     # 规则卡片、字段组件（标签/朝向/操作项/表达式）
│  │  ├─ Editor/          # 代码编辑器、Minimap、面板
│  │  ├─ Sidebar/         # 标签 / 物品 / 模板 / 主题
│  │  ├─ dialogs/         # 设置、历史、AI、语法、分享导入
│  │  ├─ TopBar.tsx       # 工具栏
│  │  ├─ Layout.tsx       # 整体布局
│  │  └─ CommandPalette.tsx
│  ├─ lib/                # i18n、AI、分享、/give、长图、音效、拖拽
│  ├─ App.tsx
│  └─ main.tsx
├─ index.html
├─ vite.config.ts
└─ package.json
```

---

## 数据与备份

- 数据存放在浏览器 **IndexedDB**（`localforage`，库名 `sfm-studio`），按站点隔离。
- 设置 → 数据 → **导出完整备份** 会生成一个 JSON（项目 + 模板 + 主题 + 设置），可跨浏览器/跨电脑恢复。
- 单个项目也可以导出 JSON；模板支持 JSON 导入导出。
- **导入项目 / 脚本**支持三种文件：完整备份 `.json`、项目 `.json`，以及从顶部「导出 .sfm」下载的脚本文件（`.sfm` 会解析为新项目，并自动补齐缺失标签）。
- 清除浏览器站点数据会丢失本地项目，请先导出备份。

---

## 分享链接与 /give

- **生成分享链接**：把当前项目的名字、规则、标签压缩进 URL hash（`#share=...`），复制到剪贴板。朋友打开链接后可直接导入为一个新项目。
  - 分享链接不包含 API Key、物品库和主题设置。
- **复制 /give 指令**：把当前 SFM 代码转义后嵌入 `writable_book` 的 NBT，生成形如
  `/give @p minecraft:writable_book{pages:[...]} 1` 的指令，进游戏粘贴即可得到一本写着脚本的书与笔。

---

## AI 助手

- 兼容 OpenAI 接口，默认 DeepSeek：`https://api.deepseek.com` + `deepseek-chat`
- 在 **设置 → AI** 中填写 Base URL、模型、API Key（仅保存在本地浏览器）
- 用自然语言描述需求（如「每秒从箱子抽取 8 个铁矿石，输出到熔炉标签」），生成的规则可「追加到列表」或「替换全部规则」
- 若提示 `Authentication Fails ... api key is invalid`，是 API Key 本身无效，请去平台重新生成；可用下面的命令单独验证：

```powershell
Invoke-RestMethod -Uri "https://api.deepseek.com/chat/completions" -Method Post `
  -Headers @{ Authorization = "Bearer sk-你的key"; "Content-Type" = "application/json" } `
  -Body '{"model":"deepseek-chat","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
```

---

## 测试

```bash
npm run test        # 单次
npm run test:watch  # 监听
```

当前覆盖：解析器 / 序列化 / 官方语法样例、规则树、拓扑分析、模拟器、分享与 `/give`，共 **8 个测试文件、100 个用例**。

```bash
npm run typecheck   # TypeScript 0 error
npm run build       # tsc --noEmit && vite build
```

---

## 常见问题

**Q：双击 `index.html` 后是空白页？**
A：确认用的是 `npm run build` 产出的 `dist/index.html`，且没有改名成 `.htm` 时丢失编码；推荐 Chrome / Edge / Firefox 最新版。

**Q：旧版本保存的项目打开后出现 `"?"` 占位符？**
A：旧版使用自定义 DSL（`block(top)`），新版已迁移为官方语法。请在 设置 → 清空本地数据，或新建项目重新搭建。

**Q：AI 一直报认证失败？**
A：见 [AI 助手](#ai-助手)，先用 PowerShell 单独验证 Key，再回填设置。

**Q：分享链接打开后每次都弹「导入分享项目」？**
A：导入后会自动清掉 hash；若手动保留了地址，把地址栏 `#` 之后删掉即可。

**Q：代码区无法输入 / 快捷键冲突？**
A：编辑器内 `Ctrl+A`、`Ctrl+Z`、`Ctrl+S` 等由 CodeMirror 处理；全局 `Ctrl+K` 与 `Ctrl+E` 会被应用拦截。

---

## 技术栈

Vite 5 · React 18 · TypeScript 5 · Tailwind CSS 3 · Zustand 5 · localforage · CodeMirror 6 · lz-string · Lucide Icons · Vitest 2 · vite-plugin-singlefile
