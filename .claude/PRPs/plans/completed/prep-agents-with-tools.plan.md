# Feature: 备课智能体接入工具调用（Exa 搜索 / URL 抓取 / 学科助手 / 图表 + Markdown 渲染 + 引用保存）

## Summary

把 4 个备课智能体（outline / lesson / exercise / activity）从「纯 prompt 一问一答」升级为
「真正能调用工具的 ToolLoopAgent」。工具集分四档：(A) **Exa 搜索/抓取/找相似** 让 agent
能联网做最新教材调研；(B) **学科助手** — 用同一 LLM 包成专门的子工具
（迷思概念排查 / 类比生成 / 评价量表 / 材料清单 / 安全提示 / 时长配比 / 课程标准对齐 /
关键词汇）；(C) **可视化** — mermaid 图表生成；(D) **纯函数** — 单位换算 / 计算器。
每个 agent 拿到与其角色相关的工具子集（不是全量；避免污染 prompt 与误调）。

同时补三个长期欠缺的 UX：assistant 消息走 **Markdown 渲染**（prompt 里早就要求"用 Markdown
标题与列表与表格组织"，但 ChatArea 一直只 `whitespace-pre-wrap` 显示原文，## 和 - 就这么
裸露给老师），保存的 `PrepRecord` 增加 `citations[]` 与 `toolTrace[]`，
`ContextStrip.onEdit` 从 toast `'未实现'` 升级成真编辑（参数能注入到 system prompt）。

## User Story

作为一名小学科学/AI 教师在备课
我希望生成大纲/教案/习题/活动时 agent 能联网核实当前课标、找最佳类比、列材料清单、
画流程图、按场景挑工具
**并且**输出按 Markdown 渲染、有可点的引用、保存后回看时还能看到这些
这样我做出的备课材料是可信、可追溯、能直接拿到课堂上用的，而不是 LLM 闭门胡编。

## Problem Statement

具体可测的问题，今天就能看到：

1. **agent 没工具**：`lib/agents/prep.ts:11-14` 的注释直接写「每个 agent 没有 tools — 与纯
   streamText 等价」。`ToolLoopAgent` 是壳，里面没料。
2. **Markdown 不渲染**：`components/ChatArea.tsx:241-251` 的 assistant 气泡用
   `whitespace-pre-wrap` + 纯文本输出。所有 `OUTLINE_PROMPT`/`LESSON_PROMPT` 等都明确要求
   "用 Markdown 标题与列表与表格组织"
   （`lib/prep-prompts.ts:7,16,25,33`），但渲染层不认 markdown，老师看到的是 `### 一、导入`
   这种带井号的字符串。
3. **ContextStrip 改不了**：`components/PrepToolPage.tsx:166` 的 `onEdit={() => toast('编辑参数功能未实现')}`
   是僵尸入口。课题/年级/学科锁死在 `app/prep/{kind}/page.tsx` 里
   （`app/prep/outline/page.tsx:8-12` 等四处都是硬编码字符串）。
4. **Context 不进 system prompt**：`contextFields` 从 page 传给 PrepToolPage 后只在 `handleSave`
   里写到 `meta`（`PrepToolPage.tsx:91-92`），**从未到达 `/api/generate`**——agent 不知道当前
   讨论的是「光的反射 三年级 科学」，每次都要老师在第一句话里重复。
5. **保存无引用**：`PrepRecord.content?: string` 是纯文本（`lib/types.ts:46`），即便 agent 引了
   3 个站点也没地方记，下次回看是断章。
6. **无法调研**：DeepSeek（OpenRouter 后面）训练截止固定，老师问"教科版 2024 修订版三年级科学
   关于光的反射的最新单元目标"——agent 只能编。

## Solution Statement

围绕 AI SDK v6 `ToolLoopAgent` + `tool()` + `stopWhen` 多步循环建一个工具集，分四档共 14 个：

```
A. Exa 联网（3）：     web_search / crawl_url / find_similar
B. 学科助手（8）：     find_misconceptions / find_analogy / generate_rubric
                      materials_list / safety_warnings / time_budget
                      match_curriculum / vocabulary_list
C. 可视化（1）：       generate_mermaid
D. 纯函数（2）：       calculator / unit_convert
```

每个 agent 只装它该用的（**curated subsets**，不是全量）。工具调用流过 SSE 时
`tool-{name}` parts 由扩展后的 ChatArea 渲染成 paper-card 状态条；最终 `text` 走
`react-markdown + remark-gfm`；引用聚合在消息末尾的 Citations 面板；保存时把 citations 与
精简 toolTrace 一起写进 `PrepRecord`，回看页同样的渲染管道。

`ContextStrip` 改成可编辑表单——课题/学科/年级 + 任意 `params`（如长度/难度/题量分布）——
状态归 PrepToolPage 持有，通过 `useChat` 的 per-request body 进 `/api/generate`，
路由把它们拼成 system prompt 的「当前上下文」段落，让 agent 第一次工具调用就知道该搜什么。

## Metadata

| Field            | Value                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Type             | ENHANCEMENT（基础设施扩展，非 bugfix）                                                       |
| Complexity       | HIGH（多文件、跨层、新外部依赖、需要 ChatArea 渲染层重做）                                   |
| Systems Affected | 工具层（新）/ agents 配置 / 生成路由 / PrepToolPage / ChatArea / 类型 / 保存与回看 / 环境变量  |
| Dependencies     | `ai@6.0.176`、`@ai-sdk/openai@3`、`@ai-sdk/react@3`、`zod@4.4.3` (existing) + `react-markdown`、`remark-gfm` (NEW) + `EXA_API_KEY` (env) |
| Estimated Tasks  | 17                                                                                           |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  /prep/lesson  (PrepToolPage)                                                  ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  ┌─Topbar────────────────────────────[ 课程▾ ][ 保存到记录 ]───────────┐       ║
║  └─────────────────────────────────────────────────────────────────────┘       ║
║                                                                                ║
║  Chapter header · 教学设计 · LESS                                              ║
║                                                                                ║
║  ┌──ContextStrip (paper-card)────────────────────────────────[ 改参数 ]┐       ║
║  │  课题 光的反射  ·  学科 科学  ·  年级 三年级                          │       ║
║  └────────────────────────────────────────────────────────────────────┘       ║
║   click "改参数" → toast: "编辑参数功能未实现" ❌                              ║
║                                                                                ║
║  ┌──ChatArea (paper-card)───────────────────────────────────────────────┐    ║
║  │  AI │ 你好，我是教学设计助手...                                        │    ║
║  │  李 │ 帮我做光的反射教案                                                │    ║
║  │  AI │ ## 教学目标                                                       │    ║
║  │     │ - 知识：理解光的反射规律                                         │    ║
║  │     │ ## 重难点                                                         │    ║
║  │     │ ⚠️ 字面 ## 和 - 就这么显示，老师看到的是源码字符 ❌                │    ║
║  │     │ ⚠️ 没工具调用，没法核实"教科版三年级"是不是已经升过版              │    ║
║  └────────────────────────────────────────────────────────────────────┘     ║
║  [保存] → POST /api/records → 只存纯文本 → 回看也只是纯文本 ❌                 ║
║                                                                                ║
║  USER_FLOW: 输入 → SSE 字符流回来 → 老师手动核实/手动重排版 → 保存            ║
║  PAIN_POINT: 不联网、不渲染、不可参数、不可追溯。"AI 像在闭门造车"             ║
║  DATA_FLOW: contextFields 永远进不到 prompt；只在 handleSave 时进 meta         ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  /prep/lesson  (PrepToolPage with tool-using agent)                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  ┌─Topbar────────────────────────────[ 课程▾ ][ 保存到记录 ]──────────┐       ║
║  └────────────────────────────────────────────────────────────────────┘       ║
║                                                                                ║
║  ┌──ContextStrip (editable mode 切换)─────────────────────────[ 完成 ]┐       ║
║  │  课题 [光的反射______]                                                │       ║
║  │  学科 [科学▾]   年级 [三年级▾]                                        │       ║
║  │  长度 [中等▾]  难度 [常规▾]  时长 [40 分▾]                            │       ║
║  └────────────────────────────────────────────────────────────────────┘       ║
║                                                                                ║
║  ┌──ChatArea (markdown + tool chips)─────────────────────────────────┐      ║
║  │  AI │ 你好，我是教学设计助手...                                       │      ║
║  │  李 │ 帮我做光的反射教案                                                │      ║
║  │  AI │ ┌ 思考过程（可展开）──────────────────┐                         │      ║
║  │     │ │ 这是 3 年级科学，先确认课标版本…    │                         │      ║
║  │     │ └────────────────────────────────────┘                          │      ║
║  │     │  🔍 搜索 "光的反射 教科版 三年级科学 课程标准"  · 完成（5 条）   │      ║
║  │     │  📄 阅读 pep.com.cn/...../guang.html              · 完成        │      ║
║  │     │  💡 排查迷思概念 "光的反射"  · 完成（4 条）                       │      ║
║  │     │  🎯 生成评价量表  · 完成                                          │      ║
║  │     │  📐 生成 mermaid 流程图  · 完成                                    │      ║
║  │     │ ┌ markdown 渲染 ──────────────────────────────────┐             │      ║
║  │     │ │ # 光的反射教案                                    │             │      ║
║  │     │ │ ## 教学目标                                        │             │      ║
║  │     │ │ - 知识：理解光线遇到镜面…                          │             │      ║
║  │     │ │ ## 板书设计                                        │             │      ║
║  │     │ │ ```mermaid                                        │             │      ║
║  │     │ │ graph LR; 光源-->镜面-->反射光                     │             │      ║
║  │     │ │ ```  ← 渲染成 SVG                                  │             │      ║
║  │     │ │ ## 评价量表 (table)                                │             │      ║
║  │     │ └────────────────────────────────────────────────┘              │      ║
║  │     │ ┌ Citations ──────────────────────────────────────┐             │      ║
║  │     │ │ [1] pep.com.cn/三上科学.../guang.html 教科版三上 │             │      ║
║  │     │ │ [2] eduhk.hk/.../misconceptions-in-light.pdf      │             │      ║
║  │     │ │ [3] curriculum.gov.cn/.../2022.pdf 课标          │             │      ║
║  │     │ └────────────────────────────────────────────────┘              │      ║
║  └────────────────────────────────────────────────────────────────────┘      ║
║                                                                                ║
║  [保存] → POST /api/records 带 citations + toolTrace → 回看时一起渲染 ✓        ║
║                                                                                ║
║  USER_FLOW: 设参数 → 一句话 → agent 多步：搜+读+助手+图 → 渲染 → 引用 → 保存   ║
║  VALUE_ADD: 联网核实、可信引用、可视化、参数化、回看不丢、所有 4 个备课 agent  ║
║  DATA_FLOW: contextFields → /api/generate 第一段 system prompt → 工具调用      ║
║             tool 输出 → SSE → ChatArea tool chip / Citations 面板             ║
║             save → PrepRecord.content + citations[] + toolTrace[]              ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                       | Before                                | After                                                                                       | User Impact                                                       |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `ContextStrip 改参数`          | toast `'未实现'`                       | 切换为编辑模式：每个字段成为 input/select；可加 `length/difficulty/duration/quota` 等参数  | 真能改课题、改年级、改长度——再也不需要复制 4 个 page.tsx 改字符串 |
| `lib/agents/prep.ts`           | `tools: undefined`（注释承认）        | 每个 agent 装 curated tools 子集，`stopWhen: stepCountIs(8)`（多步上限）                    | 模型能查、能算、能画                                              |
| `app/api/generate/route.ts`    | 接收 `{messages, kind}`              | 接收 `{messages, kind, context, params}`；把 context+params 注入 system prompt 第一段       | agent 一开局就知道课题/年级/参数                                  |
| `ChatArea` assistant 气泡       | 纯文本 `whitespace-pre-wrap`         | `<MarkdownRenderer>` （react-markdown + remark-gfm）                                         | 标题/列表/表格/代码块都正常渲染                                   |
| `ChatArea` tool parts          | 仅识别 `tool-proposeXuewenAgent` 等 3 个   | 增加通用 `<ToolStatusChip>`：识别新 14 个工具，按 input/result 状态分别显示                  | 调用过程透明                                                      |
| 消息末尾                       | 无                                    | `<CitationsPanel>` 聚合 web_search + crawl_url 的结果链接                                     | 老师可点开核实                                                    |
| `PrepRecord`（保存形态）       | `content: string`                     | + `citations?: Citation[]` + `toolTrace?: ToolTraceEntry[]`                                  | 回看不丢                                                          |
| `/records/[id]` 备课记录回看    | 用 `whitespace-pre-wrap` 渲染 content | 同 ChatArea：MarkdownRenderer + Citations                                                    | 回看体验对齐                                                      |

---

## Tool Roster

### A. Exa 联网工具（lib/tools/exa.ts）

| Tool name        | Purpose                                  | Exa endpoint                       | Inputs                                            | Returns                                              |
| ---------------- | ---------------------------------------- | ---------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `web_search`     | 通用联网搜索（标题/摘要/URL）            | POST `/search` (no `contents`)     | `query: string, numResults?: number(<=5)`         | `Array<{title,url,snippet,publishedDate?}>`          |
| `crawl_url`      | 抓取指定 URL 的正文（markdown）          | POST `/contents`                   | `url: string` （单个；批量留 Phase 2）             | `{title, url, text, publishedDate?}`                 |
| `find_similar`   | 找跟某 URL 类似的更多课程站点            | POST `/findSimilar`                | `url: string, numResults?: number(<=5)`           | `Array<{title,url,snippet}>`                         |

### B. 学科助手（lib/tools/llm-helpers.ts，全部 LLM-as-tool 模式：自调一次同一模型）

| Tool name              | Purpose                                                | Inputs                                                                  | Returns                                                                                  |
| ---------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `find_misconceptions`  | 列出学生在某主题上的常见迷思概念（教育心理学高频）       | `{ topic: string, grade: string }`                                      | `Array<{misconception, why_it_persists, how_to_address}>`                                |
| `find_analogy`         | 给出适合年级的类比/比喻                                 | `{ concept: string, grade: string, num?: number(<=3) }`                 | `Array<{analogy, mapping, limitation}>`                                                  |
| `generate_rubric`      | 三档评价量表（达成/部分达成/未达成）                     | `{ objective: string, grade: string }`                                  | `{ levels: Array<{label, descriptors:string[]}> }`                                       |
| `materials_list`       | 给定动手活动 → 每组材料 + 全班材料 + 替代品              | `{ activity: string, group_size?: number, total_groups?: number }`      | `{ per_group:Array<{name,qty,note?}>, whole_class:..., substitutes:Array<...> }`         |
| `safety_warnings`      | 给定活动 → 风险点 + 缓解措施                             | `{ activity: string, grade: string }`                                   | `Array<{risk, severity:'low'\|'med'\|'high', mitigation}>`                               |
| `time_budget`          | 把课时按4环节切分（导入/讲授/探究/小结）+ 分钟数         | `{ total_minutes: number, complexity?: 'easy'\|'normal'\|'hard' }`     | `Array<{phase:string, minutes:number, focus:string}>`                                    |
| `match_curriculum`     | 把主题映射到课程标准（教科版/人教版/课标 2022）          | `{ topic: string, grade: string, subject: string }`                     | `{ standard:string, version:string, objectives:string[], hints:string }`                 |
| `vocabulary_list`      | 主题对应的关键词汇 + 年级化解释                          | `{ topic: string, grade: string, max?: number(<=12) }`                  | `Array<{term, plain_meaning, example_sentence}>`                                         |

### C. 可视化（lib/tools/diagrams.ts）

| Tool name         | Purpose                                                                 | Inputs                                                                   | Returns                          |
| ----------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| `generate_mermaid`| 生成 mermaid 图（流程/类层次/思维导图/时序），由 markdown 内嵌渲染      | `{ kind: 'flowchart'\|'mindmap'\|'sequence'\|'classDiagram', topic }`    | `{ mermaid: string }` （source code，渲染由前端） |

### D. 纯函数（lib/tools/utils.ts）

| Tool name        | Purpose                                              | Inputs                                                          | Returns                                              |
| ---------------- | ---------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| `calculator`     | 表达式求值（仅 + - * / 与括号；不允许 eval）          | `{ expression: string }`                                        | `{ result: number, expression: string }`             |
| `unit_convert`   | 长度/质量/容积/时间/温度互换（小学常用 28 组单位）   | `{ value: number, from: string, to: string, kind?: string }`    | `{ value: number, unit: string }`                    |

---

## Per-Agent Tool Curation

不是每个 agent 都拿全部 14 个——会污染 prompt + 增加误调风险。AI SDK 支持每个 `ToolLoopAgent`
传不同的 `tools` 集合，下面是首版分配：

| Agent       | Tools (count)                                                                                                                                   | Rationale                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `outline`   | `web_search`, `find_similar`, `find_misconceptions`, `time_budget`, `match_curriculum`, `generate_mermaid` (6)                                  | 大纲偏「调研 + 框架」；要查课标 + 算时间 + 排错点 + 画结构图                       |
| `lesson`    | `web_search`, `crawl_url`, `find_misconceptions`, `find_analogy`, `vocabulary_list`, `time_budget`, `generate_rubric`, `match_curriculum` (8)   | 教案最完整；要类比、词汇、量表、时间、课标，全套                                  |
| `exercise`  | `web_search`, `crawl_url`, `find_misconceptions`, `vocabulary_list`, `calculator`, `unit_convert` (6)                                            | 习题偏「精确 + 难度梯度」；不需要图表；需要算和换算（数学题）                       |
| `activity`  | `web_search`, `crawl_url`, `materials_list`, `safety_warnings`, `time_budget`, `generate_mermaid` (6)                                            | 活动偏「可落地」；材料 + 安全是必备；mermaid 画操作步骤流程                         |

总条目 26（去重后 14）—— 每个 agent 实际装载 6–8 个，模型 prompt 长度可控。

---

## Mandatory Reading

| Priority | File                                            | Lines     | Why                                                                                                |
| -------- | ----------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| P0       | `lib/agents/prep.ts`                            | 1-46      | 4 个 ToolLoopAgent 实例 — 这次扩展的核心；要加 `tools: { ... }` 与 `stopWhen`                       |
| P0       | `app/api/generate/route.ts`                     | 1-39      | 唯一备课路由；需扩展 body schema + 注入 context+params 进 system                                     |
| P0       | `lib/prep-prompts.ts`                           | 1-47      | 4 个系统提示语；每个尾段「请先调研课标 / 必要时检索 / 用工具优先」要追加（让 agent 主动用 tools）      |
| P0       | `node_modules/ai/dist/index.d.ts:3334-3423`     | settings  | `ToolLoopAgentSettings` 全签名；含 `tools`/`stopWhen`/`toolChoice`                                  |
| P0       | `node_modules/ai/dist/index.d.ts:3527-3586`     | classes   | `ToolLoopAgent` + `createAgentUIStreamResponse` — 不需要换路由结构                                  |
| P1       | `components/ChatArea.tsx`                       | 1-300     | 已经有 tool-part 渲染骨架（`tool-proposeXuewen…`），新工具按同模式扩展                              |
| P1       | `components/PrepToolPage.tsx`                   | 1-193     | useChat 配置 + handleSave 是改造点；body 透传 + ContextStrip 编辑模式都在这里                       |
| P1       | `components/ContextStrip.tsx`                   | 1-50      | 编辑模式要"原地切换"，不是开新 modal                                                                |
| P1       | `lib/types.ts`                                  | 1-95      | `BaseRecord` 已有 `linkedCourseId`；本期再加 `Citation` / `ToolTraceEntry` 与 `PrepRecord` 字段     |
| P1       | `app/prep/{outline\|lesson\|exercise\|activity}/page.tsx` | each | 4 处硬编码 contextFields；改成「初始默认值」让 PrepToolPage state 接管                              |
| P2       | `components/AgentForm/Field.tsx`                | all       | 表单 `<Field label />` 的 paper 风格；ContextStrip 编辑模式可以蹭这套                                |
| P2       | `lib/kv.ts` + `lib/agent-storage.ts`            | tools 视角| 新工具不直接落 KV；但保存路径要带 citations+toolTrace                                                |
| P2       | `lib/openai-image.ts`                           | all       | 已有的图片生成示例（不在本期范围；列出避免重复造轮子）                                              |

**External Documentation:**

| Source                                       | Section                          | Why                                                                                                                                                                                                |
| -------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exa API (https://docs.exa.ai)                 | `/search`, `/contents`, `/findSimilar` | 端点契约 + auth header；不引入 `exa-js` 包，直接 `fetch` 与项目其他 API（如 `/api/openai-image`）一致                                                                                            |
| AI SDK v6 docs (sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling) | `tool()` + `inputSchema`            | v6 的 `tool({ description, inputSchema, execute })` —— 注意是 `inputSchema` 不是 v4/v5 的 `parameters`；execute 是 async 的，UI 可见 loading                                                  |
| AI SDK v6 docs (sdk.vercel.ai/docs/ai-sdk-core/agents) | `stopWhen`, `stepCountIs`         | 多步循环退出条件；本期用 `stepCountIs(8)`：足够 agent 调 5–6 个工具 + 写答案                                                                                                                       |
| `react-markdown@^9` README                   | "Components" + "Plugins"         | 自定义 `code` 组件以拦 `language-mermaid` 单独渲染（mermaid 浏览器渲染由 `mermaid` lib 处理；本期保留 mermaid 源代码块，浏览器渲染做成可选 P2）                                                    |

---

## Patterns to Mirror

**TOOL_DEFINITION** (AI SDK v6 — 注意 `inputSchema` 关键字):

```typescript
// SOURCE pattern in v6 (no in-repo example yet for non-trivial tools);
// closest in-repo reference: app/api/create-agent/route.ts which uses tool()
// in a streamText call. Mirror that import + signature.
import { tool } from 'ai';
import { z } from 'zod';

export const webSearch = tool({
  description: '使用 Exa 进行实时网页搜索。当需要查证课程标准、教材最新版本、或确认事实时调用。',
  inputSchema: z.object({
    query: z.string().min(2).max(120).describe('搜索词（中文优先，需具体；如"教科版三年级科学 光的反射"）'),
    numResults: z.number().int().min(1).max(5).optional().describe('返回结果数；默认 3'),
  }),
  execute: async ({ query, numResults = 3 }) => {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) throw new Error('EXA_API_KEY missing');
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ query, numResults, type: 'auto' }),
    });
    if (!res.ok) throw new Error(`Exa search failed: ${res.status}`);
    const data = await res.json() as { results: Array<{ title: string; url: string; text?: string; publishedDate?: string }> };
    return data.results.slice(0, numResults).map(r => ({
      title: r.title,
      url: r.url,
      snippet: (r.text ?? '').slice(0, 200),
      publishedDate: r.publishedDate,
    }));
  },
});
```

**LLM_AS_TOOL** (调一次同一模型，让它产出结构化 JSON):

```typescript
// SOURCE pattern: app/api/generate-persona/route.ts uses generateText to
// produce a structured JSON; mirror that with generateObject for type safety.
import { tool, generateObject } from 'ai';
import { z } from 'zod';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';

export const findMisconceptions = tool({
  description: '列出学生在某科学/AI 主题上常见的迷思概念，含原因与教学建议。',
  inputSchema: z.object({
    topic: z.string(),
    grade: z.string(),
  }),
  execute: async ({ topic, grade }) => {
    const { object } = await generateObject({
      model: deepseek.chat(DEEPSEEK_MODEL),
      schema: z.object({
        misconceptions: z.array(z.object({
          misconception: z.string(),
          why_it_persists: z.string(),
          how_to_address: z.string(),
        })).min(3).max(5),
      }),
      prompt: `面向${grade}小学生在「${topic}」主题下，列出 3-5 个最常见的迷思概念。
每条给出：1) 学生的错误想法 2) 为什么这个错误会持续 3) 教师该如何引导。
基于科学教育文献的常识；不要编造冷门内容。`,
      temperature: 0.3,
    });
    return object.misconceptions;
  },
});
```

**AGENT_WITH_TOOLS** (替换 `lib/agents/prep.ts` 现有壳):

```typescript
// MIRROR existing structure at lib/agents/prep.ts:17-21; just add tools + stopWhen.
import { ToolLoopAgent, stepCountIs } from 'ai';
import { OUTLINE_TOOLS, LESSON_TOOLS, EXERCISE_TOOLS, ACTIVITY_TOOLS } from '@/lib/tools';

export const outlineAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: OUTLINE_PROMPT,
  temperature: 0.7,
  tools: OUTLINE_TOOLS,                    // NEW
  stopWhen: stepCountIs(8),                // NEW: 多步循环上限
});
```

**ROUTE_BODY_EXTENSION** (在 `app/api/generate/route.ts` 加 context+params 注入):

```typescript
// AFTER: 接收 + 拼装 + 用 instructions override
interface RequestBody {
  messages: UIMessage[];
  kind: PrepKind;
  context?: { label: string; value: string }[];   // NEW: 课题/学科/年级
  params?: Record<string, string | number>;        // NEW: 长度/难度/时长/题量
}

// 在 createAgentUIStreamResponse 调用上方拼出 contextSection
const contextSection = body.context?.length
  ? `## 当前备课上下文\n${body.context.map(f => `- ${f.label}：${f.value}`).join('\n')}`
  : '';
const paramSection = body.params && Object.keys(body.params).length
  ? `\n## 参数\n${Object.entries(body.params).map(([k, v]) => `- ${k}：${v}`).join('\n')}`
  : '';
const augmentedInstructions = `${PREP_KIND_TO_PROMPT[kind]}\n\n${contextSection}${paramSection}\n\n## 工具使用建议\n- 关键概念先用 web_search 核实当前课标版本\n- 不要凭训练截止前的记忆编造教材版本号\n- 调用工具时简短解释为什么调用`;

return createAgentUIStreamResponse({
  agent: PREP_AGENTS[kind],
  uiMessages: messages,
  sendReasoning: true,
  prepareCall: () => ({ instructions: augmentedInstructions }),  // 见 ToolLoopAgentSettings.prepareCall (index.d.ts:3422)
});
```

**TOOL_CHIP_RENDERING** (扩展 `components/ChatArea.tsx`，新增 ToolStatusChip):

```typescript
// EXTEND existing tool-part loop at ChatArea.tsx:194-250
// 新工具的 part.type 是 'tool-{toolName}'，e.g. 'tool-web_search'
// 现有 kindFromToolType 只识别 3 个 propose*；
// 新加 PREP_TOOL_LABELS 映射 + 通用 chip 渲染：

const PREP_TOOL_LABELS: Record<string, { icon: string; label: string }> = {
  'tool-web_search':         { icon: '🔍', label: '搜索' },
  'tool-crawl_url':          { icon: '📄', label: '阅读' },
  'tool-find_similar':       { icon: '🔗', label: '找相似' },
  'tool-find_misconceptions':{ icon: '💡', label: '排查迷思' },
  'tool-find_analogy':       { icon: '🧠', label: '想类比' },
  'tool-generate_rubric':    { icon: '🎯', label: '生成量表' },
  'tool-materials_list':     { icon: '📦', label: '列材料' },
  'tool-safety_warnings':    { icon: '⚠', label: '查安全' },
  'tool-time_budget':        { icon: '⏱', label: '排时长' },
  'tool-match_curriculum':   { icon: '📚', label: '对课标' },
  'tool-vocabulary_list':    { icon: '🔤', label: '抽词汇' },
  'tool-generate_mermaid':   { icon: '📐', label: '画图' },
  'tool-calculator':         { icon: '🧮', label: '计算' },
  'tool-unit_convert':       { icon: '⇄', label: '换单位' },
};
// ChatArea 检测到 part.type 在该 map 里 → 渲染 ToolStatusChip
// state='input-streaming'  → 「正在 …」 + pulse dot
// state='input-available'  → 「正在执行 …」（input 已确定，execute 还没回）
// state='output-available' → 「✓ 完成（N 条）」
// state='output-error'     → 「✗ 失败」+ error message
```

**MARKDOWN_RENDERER** (新组件 `components/MarkdownRenderer.tsx`):

```typescript
// CREATE new file. react-markdown + remark-gfm + 自定义 paper 风格.
'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownRenderer({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (p) => <h1 className="font-display text-[20px] font-medium mt-3 mb-2" {...p} />,
        h2: (p) => <h2 className="font-display text-[17px] font-medium mt-3 mb-1.5 border-l-2 pl-2.5"
                          style={{ borderColor: 'var(--color-paper-stamp)' }} {...p} />,
        h3: (p) => <h3 className="font-display text-[15px] font-medium mt-2.5 mb-1" {...p} />,
        ul: (p) => <ul className="list-disc pl-5 my-1.5 space-y-0.5" {...p} />,
        ol: (p) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5" {...p} />,
        table: (p) => <table className="my-2 border-collapse text-[13px]"
                              style={{ borderColor: 'var(--color-paper-rule)' }} {...p} />,
        th: (p) => <th className="border px-2 py-1 text-left font-display"
                        style={{ borderColor: 'var(--color-paper-rule)', background: 'var(--color-paper-soft)' }} {...p} />,
        td: (p) => <td className="border px-2 py-1" style={{ borderColor: 'var(--color-paper-rule)' }} {...p} />,
        code: ({ className, children, ...rest }) => {
          const lang = /language-(\w+)/.exec(className ?? '')?.[1];
          if (lang === 'mermaid') {
            return <pre className="my-2 px-3 py-2 text-[12px] font-numeric"
                        style={{ background: 'var(--color-paper-soft)', border: '1px dashed var(--color-paper-rule)', borderRadius: 'var(--radius-xs)' }}>
              <code className="opacity-60">[mermaid 图表 — 浏览器渲染待 P2]</code>
              {'\n'}
              <code>{children}</code>
            </pre>;
          }
          return <code className={className} {...rest}>{children}</code>;
        },
        a: (p) => <a className="underline decoration-dotted underline-offset-2"
                      style={{ color: 'var(--color-type-dialogue)' }} target="_blank" rel="noreferrer" {...p} />,
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
```

**CITATIONS_PANEL** (新组件 `components/CitationsPanel.tsx`):

```typescript
'use client';
import type { Citation } from '@/lib/types';

export function CitationsPanel({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;
  return (
    <details
      className="self-start ml-[44px] max-w-[640px] border"
      style={{
        background: 'var(--color-paper-soft)',
        borderColor: 'var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
      }}
      open
    >
      <summary className="cursor-pointer px-4 py-2 font-numeric text-[11px] uppercase tracking-[0.14em]"
               style={{ color: 'var(--color-ink-3)' }}>
        引用 · {citations.length} 条
      </summary>
      <ol className="px-4 pb-3 pt-1 text-[12px] leading-[1.7]" style={{ color: 'var(--color-ink-2)' }}>
        {citations.map((c, i) => (
          <li key={c.url} className="flex gap-2">
            <span className="font-numeric" style={{ color: 'var(--color-ink-mute)' }}>[{i + 1}]</span>
            <a href={c.url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2"
               style={{ color: 'var(--color-type-dialogue)' }}>
              {c.title || c.url}
            </a>
            {c.snippet && <span className="ml-auto text-[11px]" style={{ color: 'var(--color-ink-mute)' }}>
              {c.snippet.slice(0, 60)}…
            </span>}
          </li>
        ))}
      </ol>
    </details>
  );
}
```

**CITATION_EXTRACTION** (在 PrepToolPage.handleSave 提取 citations 与 toolTrace):

```typescript
// 从 messages 里翻 tool-web_search / tool-crawl_url 的 output；扁平化 url+title 去重
function extractCitations(messages: UIMessage[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const m of messages) {
    for (const p of m.parts ?? []) {
      const t = p.type;
      if (t === 'tool-web_search' || t === 'tool-find_similar') {
        const out = (p as { output?: Array<{ title: string; url: string; snippet?: string; publishedDate?: string }> }).output;
        for (const r of out ?? []) {
          if (!seen.has(r.url)) seen.set(r.url, { url: r.url, title: r.title, snippet: r.snippet });
        }
      } else if (t === 'tool-crawl_url') {
        const out = (p as { output?: { title: string; url: string } }).output;
        if (out && !seen.has(out.url)) seen.set(out.url, { url: out.url, title: out.title });
      }
    }
  }
  return [...seen.values()];
}

function extractToolTrace(messages: UIMessage[]): ToolTraceEntry[] {
  const trace: ToolTraceEntry[] = [];
  for (const m of messages) {
    for (const p of m.parts ?? []) {
      if (!p.type.startsWith('tool-')) continue;
      const tp = p as { type: string; toolCallId?: string; state?: string; input?: unknown };
      if (tp.state === 'output-available' || tp.state === 'output-error') {
        trace.push({
          name: tp.type.replace(/^tool-/, ''),
          input: tp.input,
          ok: tp.state === 'output-available',
          ts: new Date().toISOString(),  // 不准确但够用
        });
      }
    }
  }
  return trace;
}
```

---

## Files to Change

| File                                    | Action | Justification                                                                                       |
| --------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `package.json` + `pnpm-lock.yaml`       | UPDATE | + `react-markdown` + `remark-gfm`（不加 `exa-js`，用 fetch）                                          |
| `.env.example`                          | UPDATE | 加 `EXA_API_KEY=` 说明                                                                              |
| `lib/types.ts`                          | UPDATE | 加 `Citation`、`ToolTraceEntry`；扩展 `PrepRecord` 含 `citations?` `toolTrace?`                       |
| `lib/tools/exa.ts`                      | CREATE | 3 个 Exa-backed tools                                                                               |
| `lib/tools/llm-helpers.ts`              | CREATE | 8 个 LLM-as-tool 学科助手                                                                           |
| `lib/tools/diagrams.ts`                 | CREATE | `generate_mermaid`                                                                                  |
| `lib/tools/utils.ts`                    | CREATE | `calculator` + `unit_convert`                                                                       |
| `lib/tools/index.ts`                    | CREATE | barrel + `OUTLINE_TOOLS` `LESSON_TOOLS` `EXERCISE_TOOLS` `ACTIVITY_TOOLS` 子集                      |
| `lib/agents/prep.ts`                    | UPDATE | 4 个 agent 注入对应 tool 子集 + `stopWhen: stepCountIs(8)`                                          |
| `lib/prep-prompts.ts`                   | UPDATE | 每段 prompt 末尾追加 "工具使用约定"（鼓励先 web_search 核实课标）                                    |
| `app/api/generate/route.ts`             | UPDATE | body 增加 `context` + `params`；用 `prepareCall` override `instructions`                             |
| `components/ContextStrip.tsx`           | UPDATE | 加编辑模式 + onChange + onDone；保留 readonly 模式做向后兼容                                         |
| `components/PrepToolPage.tsx`           | UPDATE | contextFields 升级为 state；params state；body 透传；handleSave 提 citations+toolTrace；导入 Markdown |
| `app/prep/outline/page.tsx`             | UPDATE | 把硬编码 contextFields 改成「初始默认值」（PrepToolPage 接管 state）                                  |
| `app/prep/lesson/page.tsx`              | UPDATE | 同上                                                                                                |
| `app/prep/exercise/page.tsx`            | UPDATE | 同上                                                                                                |
| `app/prep/activity/page.tsx`            | UPDATE | 同上                                                                                                |
| `components/MarkdownRenderer.tsx`       | CREATE | react-markdown 包一层，paper-style 自定义组件                                                       |
| `components/ToolStatusChip.tsx`         | CREATE | 通用 tool 状态条（streaming / running / done / error）                                              |
| `components/CitationsPanel.tsx`         | CREATE | 末尾引用面板                                                                                        |
| `components/ChatArea.tsx`               | UPDATE | assistant text → MarkdownRenderer；新工具 tool-* parts 走 ToolStatusChip；末尾插 CitationsPanel       |
| `app/records/[id]/page.tsx` 或 `PrepReplayPage` | UPDATE | 备课记录回看：MarkdownRenderer + CitationsPanel（保持渲染一致）                                     |

---

## NOT Building (Scope Limits)

显式列出不做的，避免 scope creep：

- **mermaid 浏览器端渲染**：本期只把 mermaid source 块用 `<pre>` 包住做占位。把 source code
  拿到剪贴板贴 mermaid.live 即可。Phase 2 加 `mermaid` npm 浏览器渲染组件，CSP/Tailwind v4 兼容时再上。
- **图片生成工具**：`lib/openai-image.ts` 已经存在，但本期不挂到 agent。生图慢、贵、容易跑题；
  优先做联网+学科助手，把视觉留到 Phase 2 单独权衡。
- **Tavily / Serper 替代**：用户已经决定 Exa；不开多源以免 prompt 选择困难。
- **Canvas / 可编辑 artifact**：原始 brief 提过但 implementation 复杂度独立成 plan；
  做完 tool 链之后才有产物可"画布"。
- **DELETE 时清 records:byCourse**：和上一期一致；记录 TTL 兜底。
- **工具调用的服务端审计/费率限制**：本期 demo 全裸跑，假设 Exa 免费额度（1000 调/月）够用；
  超额时 `web_search.execute` 直接抛错，UI 显示「✗ 配额耗尽」由前端兜底。
- **跨 agent 跨记录 RAG（向量库）**：不做。本期是 just-in-time 联网，不建私域索引。
- **多模型路由**（按 kind 选 GPT-4o-mini vs DeepSeek）：本期统一用现有 `DEEPSEEK_MODEL`；
  实测发现工具调用准确率不够时再换 OpenRouter `openai/gpt-4o-mini`。换模型只动 `lib/deepseek.ts` 一行。
- **流式工具调用结果（增量）**：execute 全等待完成；用户体验靠 ToolStatusChip 状态切换。
- **工具调用历史的 KV 索引/检索**：toolTrace 仅作为 PrepRecord 字段写入，不另建索引。

---

## Step-by-Step Tasks

按依赖顺序执行；每个任务后都跑 `npx tsc --noEmit` 验证。

### Task 1: UPDATE deps + env

- **ACTION**: `pnpm add react-markdown@^9 remark-gfm@^4`；`.env.example` 加 `EXA_API_KEY=`
- **GOTCHA**: 不装 `exa-js` —— 用 fetch（项目其他外部 API 也用 fetch）
- **VALIDATE**: `pnpm install` 完成；`grep EXA_API_KEY .env.example` 命中

### Task 2: UPDATE `lib/types.ts` — Citation / ToolTraceEntry / PrepRecord

- **ACTION**: 加两个 interface 与一行可选字段
- **IMPLEMENT**:
  ```typescript
  export interface Citation {
    url: string;
    title: string;
    snippet?: string;
    publishedDate?: string;
  }

  export interface ToolTraceEntry {
    name: string;              // 'web_search' | 'find_misconceptions' | …
    input: unknown;
    ok: boolean;
    ts: string;                // ISO
  }

  // 改 PrepRecord：
  export interface PrepRecord extends BaseRecord {
    type: 'prep';
    kind: PrepKind;
    content?: string;
    citations?: Citation[];     // NEW
    toolTrace?: ToolTraceEntry[]; // NEW
  }
  ```
- **MIRROR**: `lib/types.ts:30-46`（已有 `linkedCourseId` 的优化模式）
- **VALIDATE**: `npx tsc --noEmit`

### Task 3: CREATE `lib/tools/exa.ts`

- **ACTION**: 3 个 Exa-backed tools，使用 `tool({ description, inputSchema, execute })`
- **IMPLEMENT**: 见 Patterns to Mirror § TOOL_DEFINITION；同样模式实现 `crawlUrl` 与 `findSimilar`：
  - `crawlUrl`：POST `/contents` body `{ ids: [url], text: true }`；返回 `{ title, url, text: text.slice(0, 4000), publishedDate }`（4k 字符限上下文压力）
  - `findSimilar`：POST `/findSimilar` body `{ url, numResults: 3 }`；返回 search 同型
- **GOTCHA**:
  - Exa header 是 `x-api-key`（非 `Authorization: Bearer`）
  - search 默认 `type: 'auto'` 让 Exa 自己挑神经/关键词；除非测出问题别覆盖
  - text 长度截断到 4000 字符——避免单个 tool result 撑爆 context window
  - 中文 query 按原样发，Exa 会自动检测语言
  - 错误时 throw —— AI SDK 会把 error 作为 `tool-result` 的 `output-error` 状态发给 UI
- **VALIDATE**: `npx tsc --noEmit`；本地 `EXA_API_KEY=xxx pnpm dev`，手测不在本任务（实施时灰度）

### Task 4: CREATE `lib/tools/llm-helpers.ts` — 8 个学科助手

- **ACTION**: 8 个 LLM-as-tool。每个用 `generateObject` 调一次同一 model，返回结构化 JSON
- **IMPLEMENT**: 见 Patterns to Mirror § LLM_AS_TOOL；按工具表 B 的 inputs/returns 一一实现：
  | name | schema 关键点 |
  | --- | --- |
  | findMisconceptions | `misconceptions: array(.min(3).max(5))` |
  | findAnalogy | `analogies: array(.min(1).max(3))` |
  | generateRubric | `levels: array(3)` 三档：达成/部分/未达成 |
  | materialsList | per_group + whole_class + substitutes |
  | safetyWarnings | `warnings: array(.min(1))` with severity enum |
  | timeBudget | `phases: array` 4-6 段，分钟数加和 ≈ total |
  | matchCurriculum | `{ standard, version, objectives, hints }` |
  | vocabularyList | `terms: array(.min(3).max(12))` |
- **GOTCHA**:
  - `generateObject` 的 prompt 里语言定中文；temperature ≤ 0.4 让结构稳定
  - **不要用 streamObject 做工具内部** —— execute 必须返回 Promise，不是 stream
  - schema 里所有字段都 required（用 `.optional()` 时 `generateObject` 行为不稳，按 v6 推荐）
- **VALIDATE**: `npx tsc --noEmit`

### Task 5: CREATE `lib/tools/diagrams.ts`

- **ACTION**: 1 个工具 `generateMermaid`，让 LLM 产出 mermaid 源码
- **IMPLEMENT**:
  ```typescript
  export const generateMermaid = tool({
    description: '生成 mermaid 图表源码（流程图/思维导图/时序图/类层次）。返回的 source 在 markdown 里包成 ```mermaid 块。',
    inputSchema: z.object({
      kind: z.enum(['flowchart', 'mindmap', 'sequence', 'classDiagram']),
      topic: z.string(),
      hint: z.string().optional().describe('结构提示，如「水循环 4 步」'),
    }),
    execute: async ({ kind, topic, hint }) => {
      const { object } = await generateObject({
        model: deepseek.chat(DEEPSEEK_MODEL),
        schema: z.object({ mermaid: z.string() }),
        prompt: `生成 mermaid ${kind}，主题「${topic}」${hint ? `，结构：${hint}` : ''}。
要求：节点中文，每条边标关系；不超过 8 个节点；首行写 \`${kind}\` 或 \`graph LR\`；不要返回多余解释。`,
        temperature: 0.4,
      });
      return object;
    },
  });
  ```
- **GOTCHA**: 模型偶尔会用 ```mermaid 包源码，prompt 明确要求不要；前端在 markdown 渲染时自动包

### Task 6: CREATE `lib/tools/utils.ts` — 纯函数

- **ACTION**: `calculator`（白名单运算符 expr 求值，不用 eval）+ `unitConvert`（28 组小学单位）
- **IMPLEMENT**:
  - calculator：用 `Function` 构造函数前先正则白名单过滤 `^[\d\s+\-*/().]+$`，否则抛 `'unsafe expression'`
  - unitConvert：硬编码常用换算因子（cm/m/km, g/kg/t, mL/L, °C/°F, s/min/h），表驱动
- **GOTCHA**:
  - calculator 必须拒掉字母（`/[a-z]/i.test(expr)` 时直接 throw）
  - unitConvert 温度是仿射换算（C+273.15→K），别按线性来
- **VALIDATE**: `npx tsc --noEmit`

### Task 7: CREATE `lib/tools/index.ts` — 桶 + 子集

- **ACTION**: barrel + 4 个 agent 的 tool 子集 mapping
- **IMPLEMENT**:
  ```typescript
  export * from './exa';
  export * from './llm-helpers';
  export * from './diagrams';
  export * from './utils';

  import { webSearch, crawlUrl, findSimilar } from './exa';
  import { findMisconceptions, findAnalogy, generateRubric, materialsList,
           safetyWarnings, timeBudget, matchCurriculum, vocabularyList } from './llm-helpers';
  import { generateMermaid } from './diagrams';
  import { calculator, unitConvert } from './utils';

  export const OUTLINE_TOOLS = { webSearch, findSimilar, findMisconceptions,
                                 timeBudget, matchCurriculum, generateMermaid };
  export const LESSON_TOOLS = { webSearch, crawlUrl, findMisconceptions, findAnalogy,
                                vocabularyList, timeBudget, generateRubric, matchCurriculum };
  export const EXERCISE_TOOLS = { webSearch, crawlUrl, findMisconceptions,
                                  vocabularyList, calculator, unitConvert };
  export const ACTIVITY_TOOLS = { webSearch, crawlUrl, materialsList, safetyWarnings,
                                  timeBudget, generateMermaid };
  ```
- **GOTCHA**: tool 的 key（如 `webSearch`）就是 `tool-{key}` 在 UIMessage parts 里出现的名字。
  ChatArea 的 `PREP_TOOL_LABELS` 必须用 **snake_case** 还是 **camelCase**？  
  → AI SDK v6 默认用 key 名原样；camelCase 即 `tool-webSearch`。
  ChatArea 的 PREP_TOOL_LABELS 与此对齐（写 `tool-webSearch`，不是 `tool-web_search`）。
- **VALIDATE**: `npx tsc --noEmit`

### Task 8: UPDATE `lib/agents/prep.ts` — 注入 tools + stopWhen

- **ACTION**: 替换 4 个 ToolLoopAgent 实例，加 `tools` 与 `stopWhen`
- **IMPLEMENT**: 见 Patterns to Mirror § AGENT_WITH_TOOLS
- **MIRROR**: `lib/agents/prep.ts:17-21`
- **GOTCHA**: 注释 `lib/agents/prep.ts:11-14` 要更新（不再是"等价于纯 streamText"）
- **VALIDATE**: `npx tsc --noEmit`；agent 实例化必须不报 ToolLoopAgentSettings 类型错

### Task 9: UPDATE `lib/prep-prompts.ts` — 加工具使用约定

- **ACTION**: 每段 prompt 末尾插 "## 工具使用约定" 段
- **IMPLEMENT**:
  ```
  ## 工具使用约定
  - 涉及"教科版/课标 N 年级 X 学科"等具体版本时，先调 web_search 核实
  - 调用工具时简短解释为什么调用（"先查一下当前课标..."）
  - 引用资料只用工具返回的 url；不要自己编造链接
  - 调到 5–6 个工具就停下来收尾，不要无限调
  ```
- **GOTCHA**: 4 段 prompt 末尾的 "末尾问一句..." 这一行保留在最后；工具约定插到它之前
- **VALIDATE**: `npx tsc --noEmit`

### Task 10: UPDATE `app/api/generate/route.ts` — body 扩展 + prepareCall

- **ACTION**: body 增加 `context` + `params` 字段；用 `prepareCall` override `instructions` 为 augmented 版
- **IMPLEMENT**: 见 Patterns to Mirror § ROUTE_BODY_EXTENSION
- **MIRROR**: `app/api/generate/route.ts:8-11`（RequestBody）
- **GOTCHA**:
  - `createAgentUIStreamResponse` 的 `prepareCall` 在 `node_modules/ai/dist/index.d.ts:3422`；签名复杂，先按 `({ instructions: ... })` 局部返回测试
  - 如果 prepareCall 类型卡住，退而求次：在 lib/agents/prep.ts 里把 instructions 也参数化（导出工厂函数 `makePrepAgent(kind, contextSection)`），路由按需创建——不缓存 agent 实例
- **VALIDATE**: `npx tsc --noEmit`；POST 一份 mock body 看 200

### Task 11: UPDATE `components/ContextStrip.tsx` — 加编辑模式

- **ACTION**: 接受新 props `editing?: boolean`、`onFieldChange?: (label, value)`、`extraParams?: { label, options }[]`
- **IMPLEMENT**: 渲染分支：
  - readonly 模式：保留现有 `<span>` 渲染
  - editing 模式：每个 field 改成 `<input>` 或 `<select>`（subject/grade 给 select；课题给 input）；params 区另起一行
- **MIRROR**: `components/AgentForm/Field.tsx`（paper 风格 input 包装）
- **GOTCHA**: 不引入新 modal/抽屉；原地切换是 design principle "Editorial hierarchy beats card uniformity"
- **VALIDATE**: `npx tsc --noEmit`

### Task 12: UPDATE `components/PrepToolPage.tsx` — state + body 透传 + Markdown 集成

- **ACTION**: 多处改动：
  1. `contextFields` 从 prop 升级为初始值；`useState` 接管
  2. 加 `params` state（`{ length, difficulty, duration, quota? }`）
  3. `editing` state 控 ContextStrip 模式
  4. `useChat` 不再静态 body：改用 `sendMessage` 时传 per-call body 或 transport 的 `prepareSendMessagesRequest`
  5. handleSave：调用 `extractCitations` + `extractToolTrace`，发送字段加 `citations` + `toolTrace`
  6. 引入 `<MarkdownRenderer>` —— 不直接用，是给 ChatArea 用；这里只是确保 import path 对
- **IMPLEMENT**: 见 Patterns to Mirror § CITATION_EXTRACTION
- **GOTCHA**:
  - useChat 的 transport.body 是创建时绑定的；动态 context 通过 `prepareSendMessagesRequest` 解：
    ```typescript
    transport: new DefaultChatTransport({
      api: '/api/generate',
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages, kind, context: contextFields, params },
      }),
    }),
    ```
  - `contextFields` 改后 transport 重建：把 transport 用 `useMemo` 包，依赖 `[kind, contextFields, params]`
- **VALIDATE**: `npx tsc --noEmit`；`pnpm dev` /prep/lesson 改"课题"为"动物分类"，看 Network /api/generate body

### Task 13: UPDATE 4 个 prep page

- **ACTION**: `app/prep/{outline,lesson,exercise,activity}/page.tsx` —— contextFields 改成"初始默认值"
  （PrepToolPage state 接管），其余字符串保留
- **IMPLEMENT**: 不变；只是语义从 props.constant 变为 props.defaultValue
- **VALIDATE**: `npx tsc --noEmit`

### Task 14: CREATE `components/MarkdownRenderer.tsx`

- **ACTION**: react-markdown + remark-gfm + paper-style 自定义组件
- **IMPLEMENT**: 见 Patterns to Mirror § MARKDOWN_RENDERER
- **GOTCHA**:
  - mermaid block 这一期只渲成占位灰底（P2 才上 mermaid lib）
  - 自定义 components 字段名：`a` `h1` `h2` 等小写——是 react-markdown v9 的契约
- **VALIDATE**: `npx tsc --noEmit`

### Task 15: CREATE `components/ToolStatusChip.tsx`

- **ACTION**: 通用工具状态条，按 part.state 切换文案 + 颜色
- **IMPLEMENT**:
  ```typescript
  // streaming/running -> pulse dot + "正在 ..."
  // done             -> ✓ + "完成（N 条）" or "完成"
  // error            -> ✗ + error message
  // 用 paper-soft 底 + paper-edge 边线，不喧宾夺主
  ```
- **MIRROR**: `components/ChatArea.tsx:206-220`（agent-create 已有的 input-streaming chip）
- **VALIDATE**: `npx tsc --noEmit`

### Task 16: CREATE `components/CitationsPanel.tsx` + UPDATE `ChatArea`

- **ACTION**: CitationsPanel 文件 + ChatArea 集成
- **IMPLEMENT**:
  - CitationsPanel 见 Patterns to Mirror § CITATIONS_PANEL
  - ChatArea 改动：
    1. 把 assistant text 那个气泡内的 `{text}` 换成 `<MarkdownRenderer source={text} />`（user 气泡保持纯文本）
    2. 在 `tool-` parts 循环里：`PREP_TOOL_LABELS` 里有的 part.type 走 `<ToolStatusChip>`；保留原 propose* 的 DraftRow 渲染
    3. 在每条 assistant message 末尾（text 已结束、tool 结束）加 `<CitationsPanel citations={extractCitationsForMessage(m)} />`（只取该 message 的 tool output）
- **GOTCHA**:
  - User 气泡不渲 markdown（避免输入框里的 `*强调*` 被误吃成斜体）
  - CitationsPanel 排在 markdown 气泡之后、下一 message 之前——视觉上"附录"
  - extractCitationsForMessage 是 ChatArea 内部 helper，与 PrepToolPage.handleSave 的 extractCitations 共享逻辑（提到 `lib/citations.ts` util，避免重复）→ 这一步细化时如发现重复，提取成 util
- **VALIDATE**: `npx tsc --noEmit`；UI 手测 markdown 渲染、tool chip、citations 面板

### Task 17: UPDATE `app/records/[id]/page.tsx` 或 `PrepReplayPage` — 回看也走 markdown + citations

- **ACTION**: 备课记录回看时使用相同的 `MarkdownRenderer` + `CitationsPanel`
- **IMPLEMENT**:
  - 找现有 PrepReplayPage（在 e606611 commit 添加）
  - replay 页中：`record.content` → MarkdownRenderer；`record.citations` → CitationsPanel
  - 老记录（无 citations）静默跳过 panel
- **GOTCHA**: 对老的 fallback records（`lib/fallback-records.ts`），content 是单行简介；MarkdownRenderer 渲染单行也 OK，不会挂
- **VALIDATE**: `npx tsc --noEmit && pnpm next build`；`/records/{某条新生成的记录}` 看渲染 + 引用

---

## Testing Strategy

repo 无测试 runner（package.json 仅 dev/build/start）。验证靠 tsc + build + 手测。

### Smoke Checklist (要在 demo 上跑通)

- [ ] `pnpm dev` 启动；`EXA_API_KEY=...` 配 `.env.local`
- [ ] /prep/outline：默认 contextFields 显示「水的三态变化 / 科学 / 三年级」
- [ ] 点「改参数」→ 切编辑模式 → 把课题改「动物分类」→ 「完成」→ 输入「帮我做大纲」→
       Network 看 POST /api/generate body 含 `context: [{label:'课题',value:'动物分类'}, ...]`
- [ ] agent 调 web_search → ChatArea 显示「🔍 搜索 ‘…’ 正在...」chip → 转「✓ 完成（N 条）」
- [ ] agent 输出 markdown → 有 # / - / **粗体** / table 都正常渲染
- [ ] 末尾出现 Citations 面板，点链接 new tab 打开
- [ ] 保存 → 跳 /records → 该条目存在 → 点进去回看 → markdown 与 citations 一起显示
- [ ] /prep/lesson、/prep/exercise、/prep/activity 同上路径都跑一遍（不同工具集）
- [ ] EXA_API_KEY 故意空 → 调 web_search 时 ChatArea 显示「✗ EXA_API_KEY missing」chip，但
      其他 LLM-as-tool 仍可工作；最终 markdown 仍出
- [ ] 工具调用循环不超过 8 步（stepCountIs(8)）
- [ ] CLAUDE.md 反参考：所有 chip + 面板用 paper-card / paper-rule / 学问蓝；无 Inter/Plus Jakarta
- [ ] 1m 投影测试：tool chip + citations 在 1080p 投影 2m 距离仍可读

### Edge Cases

- [ ] /api/generate 没传 context → augmentedInstructions 不出现 "## 当前备课上下文" 段（容空）
- [ ] Exa quota 耗尽 → web_search throw → UI 显示错误 chip → agent 收到 tool-result error → 改用其他工具继续
- [ ] crawlUrl 拿到的 text 含有非 UTF-8 / 控制字符 → 上游 fetch 已是 utf8 解码，但 `text.slice(0, 4000)` 后送 model 不挂
- [ ] generateObject schema 失配（model 出错位）→ AI SDK 自动 retry 一次；仍失败 → execute throw → UI 显示错误
- [ ] 保存时 messages 为空（initial greeting + 没回答就点保存）→ 现有 `if (!content)` 兜底沿用
- [ ] 老 records（无 toolTrace 字段）→ 回看 PrepReplayPage 不挂；CitationsPanel 不渲染（length 0 早返回）
- [ ] markdown source 含潜在 XSS（`<script>`）→ react-markdown 默认转义；不需要额外 sanitize 库

---

## Validation Commands

### Level 1: Static Analysis

```bash
npx tsc --noEmit
```

**Expect**: exit 0。新工具 + 新组件 + agent 重写的所有类型都对齐。

### Level 2: Unit Tests

N/A（无 runner）

### Level 3: Build

```bash
pnpm next build
```

**Expect**: 23+ 路由全编译过。注意 `lib/tools/llm-helpers.ts` 因为 import generateObject 与
DEEPSEEK_MODEL，会在 build 时尝试 import @ai-sdk/openai；env 变量不在 build 时 require，OK。

### Level 4: Database Validation

无 schema 改动；KV Set/List 用法不变。`PrepRecord` 加可选字段是 forward-compatible，
老 record 不需要迁移。

### Level 5: Browser Validation

按 Smoke Checklist。

### Level 6: Manual Validation (E2E happy path)

1. /prep/outline，点「改参数」改课题为「光的反射」，年级「三年级」
2. 输一句「帮我出大纲」
3. 看 ChatArea 出现：思考过程 → 🔍 搜索 → 📚 对课标 → ⏱ 排时长 → 📐 画图 → markdown 输出
4. Citations 出现 ≥1 条；点开能跳源链接
5. 顶栏选课程「生命世界」，点「保存到记录」
6. 跳 /records，看到新条目（avatar=「水」）
7. 点开该记录，看到 markdown 渲染 + Citations 面板
8. 同样流程跑 /prep/lesson、/prep/exercise、/prep/activity

---

## Acceptance Criteria

- [ ] 4 个 ToolLoopAgent 都装上各自的 curated tools，注释更新
- [ ] `lib/tools/` 下 5 个文件齐全（exa / llm-helpers / diagrams / utils / index）
- [ ] 14 个工具的 description 都是中文 + 给模型清晰调用线索
- [ ] `app/api/generate/route.ts` 接受 `context` + `params`；instructions 拼接正确
- [ ] ContextStrip 编辑模式可改课题/学科/年级 + 至少 2 个 params（length / difficulty）
- [ ] ChatArea：assistant text 走 markdown；新工具 part.type 走 ToolStatusChip；末尾有 Citations
- [ ] PrepRecord 保存时 citations + toolTrace 都进 KV；回看页一样渲染
- [ ] 老 records（无 citations 字段）回看不挂
- [ ] 无新 npm 依赖增加之外（仅 react-markdown + remark-gfm；不加 exa-js）
- [ ] `npx tsc --noEmit` + `pnpm next build` 都过
- [ ] CLAUDE.md 字体/反参考清单：无违反；只用 paper-card / paper-rule / 学问蓝/讨论青/辩论红
- [ ] 4 个 page.tsx 中没有遗留的"硬编码 contextFields"语义改成"初始默认值"

---

## Risks and Mitigations

| Risk                                                                                    | Likelihood | Impact | Mitigation                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DeepSeek 工具调用准确率不够**：生成大量"我不知道，需要工具"但调不对                  | MED        | HIGH   | 通过 prep-prompts 的"工具使用约定"硬约束；如真不行，把 `lib/deepseek.ts` 的 `DEEPSEEK_MODEL` 切到 `openai/gpt-4o-mini`（OpenRouter 仍可访问），单行改动                                              |
| **Exa 配额耗尽**（免费 1000/月）                                                         | LOW (demo) | LOW    | execute throw → ChatArea 显示错误 chip；其他工具继续可用                                                                                                                                              |
| **工具循环爆炸**（agent 反复调同工具）                                                   | LOW        | MED    | `stopWhen: stepCountIs(8)` 已硬上限                                                                                                                                                                 |
| **markdown XSS 注入**（教师粘贴恶意外站内容到 prompt → 模型回吐）                        | LOW        | MED    | react-markdown 默认 escape；不开 `rehype-raw`                                                                                                                                                         |
| **prepareCall 类型签名复杂**（index.d.ts:3422 一长串 Pick）                              | MED        | LOW    | 退路：导出 `makePrepAgent(kind, contextSection)` 工厂，路由按需创建实例；放弃 prepareCall 走「instance per request」                                                                                |
| **useChat 动态 body 不稳定**                                                             | MED        | MED    | 用 transport `prepareSendMessagesRequest`（v6 新加，最稳）；不依赖 transport 重建 + 闭包捕获                                                                                                          |
| **Citations 面板挤压垂直空间**                                                           | LOW        | LOW    | 默认 collapsed（`<details>` open 但小屏可关）；行高 1.7、字体 12px                                                                                                                                    |
| **mermaid 占位丑**                                                                      | MED        | LOW    | 已显式承认：P2 才渲染。占位 pre 用虚线框 + 灰底，不做"看起来正在加载"假象（参考 silent-failure-hunter 原则）                                                                                          |
| **toolTrace 体积大**（含 input/output 全文）                                             | MED        | MED    | 只存 `name + input + ok + ts`（不存 output——output 已在 markdown 里）；TTL 30 天兜底；记录 size 自然有限                                                                                          |
| **ContextStrip 编辑模式破坏顶部对齐**                                                    | MED        | LOW    | 编辑模式独立行高；用 max-height transition；不超出现有 `mb-5` 间距；如需 overflow → 内层 scroll                                                                                                       |
| **stale fallback records 出现 mermaid 字段不渲染**                                       | LOW        | LOW    | fallback content 不含 mermaid；MarkdownRenderer 对纯文本字符串等价于 `<p>...</p>`                                                                                                                     |

---

## Notes

**为什么不用 `exa-js` npm 包：**

`fetch` 一行能干的事（POST + JSON），加包带来 ~30KB 客户端 footprint（还要 tree-shake）。
项目其他外部 API（OpenRouter、OpenAI 图像）都是 fetch；保持一致。`exa-js` 的便利只在
"自动 retry / pagination"，本期不需要这两个。

**为什么把工具按 agent 分子集而非全量：**

prompt 长度 ≈ tools description 长度之和；14 个工具全描述 ~3KB 文本注入每次调用。模型对
长 tool 列表选择困难（学界叫 "tool selection ablation"——超过 8 个工具时准确率显著下降）。
按 agent 划分让每个 agent 看到 6-8 个高相关工具，准确率换 prompt 长度。

**为什么 LLM-as-tool 而不是 fine-tune 小模型：**

demo 阶段，「找类比 / 列材料」用 generateObject 调一次同一模型 + 严格 schema，比训一个
专门小模型快 100 倍迭代。当某个 LLM-as-tool 调用率特别高（>30%）时，再考虑独立 endpoint。

**为什么把 ContextStrip 改成编辑而不是开 modal：**

CLAUDE.md design principle 1：「Paper over chrome — 用栏宽、版口、栏线、章节号、侧栏标签
分层；少用 shadow + 圆角 + gradient」。Modal 是典型 chrome；原地编辑是 paper（页面上的栏）。

**为什么不在 /api/records 里校验 citations[] 形状：**

records 路由维持手填校验风格（`if (!body.type || !body.title)`，`route.ts:30`）。citations
是 optional 数组；服务端不解构。如果将来需要校验，独立加 zod schema，不影响其他保存流。

**关于 toolChoice：**

`ToolLoopAgentSettings.toolChoice` 默认 `'auto'`（模型自决定）。本期不显式配置；如发现
某 agent 不主动用工具，把 `outline` 改 `toolChoice: 'required'` 强迫至少一次。

**Phase 2 路线（不在本期）：**

1. **mermaid 浏览器渲染**（`mermaid` lib + ssr 兼容）
2. **图片生成工具**（接 `lib/openai-image.ts`）
3. **画布 / artifact 模式**（streamObject 流结构化教案，右栏 LessonCanvas 实时编辑）
4. **多模态输入**（老师上传一张课本插图 → agent 看图列教学要点）
5. **跨记录 RAG**（已生成的优秀记录 → 向量化 → 给 agent 当参考）
6. **TTS 课文播放**（保存的课件大纲 → ElevenLabs / OpenAI tts → 课堂播放）
7. **音频识别 → 课堂笔记**（老师课中录音 → whisper → agent 整理）

每条 Phase 2 都是独立 plan；本期工具基础设施落定后并行可做。

**置信度自评：8/10**

- 主要风险是 DeepSeek 模型实际工具调用稳定性 —— 没在这个项目实测过，已经写了 `lib/deepseek.ts`
  改一行换模型的退路
- 第二风险是 prepareCall API 在 v6 还没有大量样例 —— 已写好工厂模式 fallback
- markdown 渲染、ChatArea 扩展、保存字段扩展、ContextStrip 编辑——都是项目里有同类先例的低风险变更
