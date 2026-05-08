# Feature: /create 流程 HITL 确认 + 冷启动 + AI 形象生成

## Summary

把 `/create` 的"AI tool call → 右栏自动展开"改为 HITL 二段确认：AI 出草稿 → chat 内卡片 [应用到表单 / 继续修改 / 重新生成] → 用户点"应用"才把右栏从"等 AI 判断类型"展开成填好的表单。同时给三类 schema 加 `coldStart`（开场白）字段，让 AI 生成时一次性写好；并给 学问 加"AI 生成人物形象"分支，覆盖 6 张 catalog 之外的人物（爱因斯坦/特斯拉等）。辩论/讨论同步走同一确认链路 + cold-start，确保完整度对齐。

## User Story

As a 小学科学/AI 课老师
I want to 在 `/create` 跟 AI 聊一句"给我个三年级讲磁铁的牛顿"或"做个讲相对论的爱因斯坦"
So that AI 出完整草稿后我先在 chat 里看一眼再决定要不要应用，应用后右栏出现填好的表单（含背景、开场白），保存后进入使用页时智能体直接用 AI 写的开场白说话；catalog 里没有的人物也有 AI 现画的头像/全身像

## Problem Statement

当前（`components/AgentCreatePage.tsx:115-123`）：AI 一调 tool（`input-available`）就立刻 `setFormState(call.input)` + `setCurrentKind` + 弹 toast，右栏从空态翻到表单。问题：
1. **没有"再确认"环节** — 用户还没看清 AI 写了什么，表单已经填好；用户对 AI 草稿的可控感不足
2. **角色背景只能依赖人物原型** — `personaId` 是 6 选 1 enum（`lib/asset-catalog.ts:28-72`）；用户说"爱因斯坦"AI 会跳过 personaId、`XuewenUsePage` 头像/全身像位置直接降级首字符，使用页观感差一档
3. **冷启动对话是死的** — `XuewenUsePage:60-75` 的开场白硬编码成 `你好！我是${name}。你想跟我聊点什么？`，跟 AI 写的人物背景脱节；辩论/讨论页根本没有冷启动消息
4. **辩论/讨论的 AI 生成完整度未对齐** — Discussion form 的 6 条默认 scaffolds 与 `lib/agents/create-unified.ts:45-51` 提示词里的默认 scaffolds 文案不一致（drift），AI 生成的草稿无法直接覆盖 form 的 placeholder

## Solution Statement

四件事，按依赖顺序：

1. **Schema 扩展**（`lib/agent-schemas.ts`）：三个 schema 都加 `coldStart` 字段；`XuewenAgentSchema` 加 `personaCustom` 分支（avatarUrl/roleUrl）；统一 Discussion 默认 scaffolds 文案。
2. **HITL 确认卡**（`components/ChatArea.tsx` 内的 tool part 渲染 + `components/AgentCreatePage.tsx` 的应用逻辑）：把"`✓ 草稿已生成`"小标改成富卡片，含 [应用到表单 / 继续修改]；AgentCreatePage 改成等用户点击 [应用] 才 setFormState。
3. **AI 生成人物形象**（新 `app/api/generate-persona/route.ts` + `components/AssetPicker/PersonaPicker.tsx` 加"✨ AI 生成"分支）：返回 base64 data URL，写入 `personaCustom`；XuewenUsePage / RoleCard 的取图函数扩展为 catalog 优先 → custom 兜底。
4. **三类 use 页接入冷启动**（`XuewenUsePage` / `DebateUsePage` / 新 `DiscussionUsePage`）：开场消息读 `coldStart` 或 fallback 到现有硬编码。

## Metadata

| Field | Value |
|------|------|
| Type | ENHANCEMENT |
| Complexity | MEDIUM |
| Systems Affected | `/create` 页、三个 use 页、agent schema、agent storage、AI 创建 instructions（4 处）、PersonaPicker、新 image-gen API |
| Dependencies | `ai@6.0.176`（已装；`generateImage`）、`@ai-sdk/openai@3.0.63`（已装）、`zod@4.4.3`（已装）、新增可选 env `OPENAI_API_KEY` 用于直连 OpenAI 图像模型（OpenRouter 不稳定支持） |
| Estimated Tasks | 14 |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                          BEFORE — 一步到位（无确认）                           ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─ 左：对话栏 ───────────────────────┐ ┌─ 右：配置 ──────────────────────┐  ║
║  │ AI: 你好…告诉我你想做什么 agent  │ │  [空态：等 AI 判断类型]         │  ║
║  │                                  │ │                                 │  ║
║  │ 用户: 三年级讲磁铁的牛顿         │ │                                 │  ║
║  │                                  │ │                                 │  ║
║  │ AI: 已为你生成 学问 草稿…        │ │  ◀═ 同一瞬间被 useEffect 填满 ══│  ║
║  │ ✓ 学问草稿已生成 — 请在右侧查看  │ │  人物形象 [□□□□□□]            │  ║
║  │                                  │ │  名称   [牛顿]                  │  ║
║  └──────────────────────────────────┘ │  角色背景 [...80字...]          │  ║
║                                        │  学科 [科学]   年级 [三年级]    │  ║
║                                        └─────────────────────────────────┘  ║
║                                                                               ║
║  PAIN_POINT_1: 用户没机会"看一眼再决定"，表单瞬间被覆盖                       ║
║  PAIN_POINT_2: catalog 6 人之外（爱因斯坦/特斯拉/居里夫人之外的人）头像直接降级  ║
║  PAIN_POINT_3: 进入使用页后开场白与角色脱节："你好！我是牛顿。你想跟我聊点什么？"║
║  DATA_FLOW: chat msg → ToolLoopAgent → tool-input-available → useEffect 立即应用 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       AFTER — HITL 二段确认 + 冷启动 + 自定义人物              ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─ 左：对话栏 ────────────────────────┐ ┌─ 右：配置 ──────────────────────┐ ║
║  │ AI: 你好…                          │ │  [空态：等 AI 判断类型]         │ ║
║  │ 用户: 给我个讲相对论的爱因斯坦      │ │  ▼ 等候用户应用草稿              │ ║
║  │ AI: 已生成 学问 草稿，可应用      │ │                                 │ ║
║  │  ┌──────────────────────────────┐  │ │                                 │ ║
║  │  │ ┃ 学问草稿              ✓   │  │ │                                 │ ║
║  │  │ ┃ 名称：爱因斯坦              │  │ │                                 │ ║
║  │  │ ┃ 学科·年级：科学 · 五年级    │  │ │                                 │ ║
║  │  │ ┃ 背景：相对论奠基人，喜欢用…│  │ │                                 │ ║
║  │  │ ┃ 形象：⚠ 不在 6 人 catalog  │  │ │                                 │ ║
║  │  │ ┃        [✨ AI 生成形象]   │  │ │                                 │ ║
║  │  │ ┃ 开场白：你好同学们…        │  │ │                                 │ ║
║  │  │ ┠──────────────────────────  │  │ │                                 │ ║
║  │  │ ┃  [应用到表单] [继续修改]    │  │ │                                 │ ║
║  │  │ ┃  [✕ 重新生成]               │  │ │                                 │ ║
║  │  │ └──────────────────────────────┘  │ │                                 │ ║
║  │                                    │ │                                 │ ║
║  │  ─── 用户点 [应用到表单] ───────────────────────────────────▶          │ ║
║  │                                    │ │                                 │ ║
║  │ 用户: 把背景改一下，更口语化       │ │  人物形象 [⚙️ AI 生成的爱因斯坦]│ ║
║  │ AI: 改好了 (新草稿卡覆盖前一张)    │ │  名称 [爱因斯坦]                │ ║
║  │                                    │ │  角色背景 [..已应用..]          │ ║
║  └────────────────────────────────────┘ │  开场白 [你好同学们…]           │ ║
║                                          │  科目 [科学] 年级 [五年级]      │ ║
║                                          └─────────────────────────────────┘ ║
║                                                                               ║
║  ─── 保存 → /use/xuewen/[id] ─────────────────────────────────────────────▶  ║
║                                                                               ║
║  ┌─ 使用页（学问） ─────────────────────┐                                    ║
║  │ AI: 你好同学们！我是爱因斯坦…(读 coldStart, 不再硬编码)                    ║
║  │ 头像/全身像：用 personaCustom.avatarUrl / roleUrl                          ║
║  └──────────────────────────────────────┘                                    ║
║                                                                               ║
║  VALUE_ADD_1: 用户对 AI 草稿有"二段把关"，表单不会被瞬间覆盖                  ║
║  VALUE_ADD_2: catalog 之外人物也有 AI 现画的头像/全身像                       ║
║  VALUE_ADD_3: 使用页开场白与配置一致，更"角色感"                              ║
║  VALUE_ADD_4: 辩论/讨论同样走 HITL 卡 + cold-start，三类完整度对齐            ║
║  DATA_FLOW: chat msg → ToolLoopAgent → tool-input-available → 卡片渲染       ║
║             → 用户点[应用] → 客户端 setFormState（无 addToolOutput 回环）     ║
║             → personaPicker [AI 生成] → POST /api/generate-persona → data URL ║
║             → 保存 → KV 含 personaCustom + coldStart → use 页直接读           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|------|------|------|------|
| `/create` chat tool 卡片 | 单行小标"草稿已生成—请右侧查看" | 富卡片（字段摘要 + 应用/修改/重生 按钮） | 看清 AI 写了什么再决定 |
| `/create` 右栏 | tool input 一到立刻渲染表单 | 等用户点[应用] 才渲染 | 表单不会被覆盖；同一对话里可以保留多次草稿 |
| `XuewenForm` 人物形象区 | 6 选 1 catalog grid | 6 选 1 + 末位 [✨ AI 生成形象] | catalog 之外也能给"形象" |
| `XuewenForm` 新增"开场白"字段 | 无 | textarea，AI 预填，可改 | 使用页第一句不再硬编码 |
| `DebateForm` / `DiscussionForm` 新增"开场白"字段 | 无 | textarea | 辩论/讨论使用页也有引言 |
| `XuewenUsePage` 开场白 | `你好！我是${name}。…` 硬编码 | `cfg.coldStart ?? fallback` | 与角色风格一致 |
| `DebateUsePage` 开场 | 无 | 顶部辩题条下方加"赛前提示词"消息（读 cfg.coldStart） | 辩论开场更正式 |
| 新 `DiscussionUsePage` | 不存在（讨论使用页本期没真页） | 本计划不新建，仅 schema 准备好 | 留给下一期 |

---

## Mandatory Reading

**实现前 agent 必须读这些文件：**

| Priority | File | Lines | Why |
|------|------|------|------|
| P0 | `components/AgentCreatePage.tsx` | 全部（337） | 主战场：右栏空态/表单切换、useEffect 自动应用逻辑都在这里 |
| P0 | `lib/agent-schemas.ts` | 1-171 | schema 单一真源；要加 coldStart + personaCustom |
| P0 | `lib/agents/create-unified.ts` | 1-77 | unified instructions：新字段要写进 prompt 让 AI 填 |
| P0 | `lib/agents/create-xuewen.ts` | 1-44 | 模板路径用的 single-tool agent，三处改动同步 |
| P0 | `lib/agents/create-debate.ts` | 1-40 | 同上 |
| P0 | `lib/agents/create-discussion.ts` | 1-46 | 同上；注意 6 条 scaffolds 文案 drift |
| P0 | `components/ChatArea.tsx` | 121-220 | tool part 渲染逻辑，HITL 卡渲染要在这层做 |
| P1 | `components/XuewenUsePage.tsx` | 60-83 | 开场白硬编码点；接入 `cfg.coldStart` |
| P1 | `components/DebateUsePage.tsx` | 230-260 | 辩题条区，开场提示要插在这里 |
| P1 | `components/AssetPicker/PersonaPicker.tsx` | 全部（69） | 加 [AI 生成] tile 的位置 |
| P1 | `lib/asset-catalog.ts` | 1-258 | `getXuewenPersona` 要扩展为 catalog → custom 兜底 |
| P1 | `components/AgentForm/Xuewen.tsx` | 全部（114） | 加开场白 Field |
| P1 | `components/AgentForm/Debate.tsx` | 全部（212） | 加开场白 Field |
| P1 | `components/AgentForm/Discussion.tsx` | 13-20, 全部 | 同时修 default scaffolds 文案 + 加开场白 |
| P2 | `app/api/create-agent/route.ts` | 1-60 | 路由不需要改，但要确认依然 ToolLoopAgent + sendReasoning |
| P2 | `lib/deepseek.ts` | 全部（17） | 现走 OpenRouter；新 `/api/generate-persona` 要不要复用要在这里看 |

**External Documentation（本地 ai-sdk 仓库内文档）:**

| Source | Section | Why |
|------|------|------|
| `node_modules/ai/docs/04-ai-sdk-ui/03-chatbot-tool-usage.mdx` | 全文 | useChat tool part state machine（input-streaming → input-available → output-available）；HITL 卡的状态判断 |
| `node_modules/ai/docs/03-ai-sdk-core/35-image-generation.mdx` | 1-180 | `generateImage` API 形参；size / aspectRatio / providerOptions |
| `node_modules/ai/docs/03-agents/02-building-agents.mdx` | n/a | ToolLoopAgent 的 client-side tool（无 execute）→ 自动终止 loop 的契约 |

注意：本期不引入 `addToolOutput`／`sendAutomaticallyWhen`。HITL 仅是"客户端是否把 input 写进 form"的本地决策，不需要把"应用/不应用"作为 tool result 回流给 LLM——agent 已经在 client-side tool 处自动 stop，再发回 result 会触发额外 loop，浪费 token 且让 AI "误以为" 用户接受了某个版本。

---

## Patterns to Mirror

**TOOL_PART_RENDER_BY_STATE:**

```tsx
// SOURCE: components/ChatArea.tsx:178-219
// COPY 这个 state-machine 模式，把 input-available 分支换成富卡片
{toolParts.map(part => {
  const kind = kindFromToolType(part.type);
  if (!kind) return null;

  if (part.state === 'input-streaming') { /* 小标"正在生成" */ }
  if (part.state === 'input-available' && part.input && part.toolCallId) {
    // 现状：单行 ✓ 标 → 改：富卡片 + applyDraft 回调
  }
  return null;
})}
```

**FIND_LATEST_TOOL_CALL:**

```tsx
// SOURCE: components/AgentCreatePage.tsx:69-87
// 这个函数的契约保留：返回最新一次 tool call 的 {kind, id, input}
function findLatestCreateCall(messages: UIMessage[]): {
  kind: CreateKind;
  id: string;
  input: AnyConfig;
} | null { /* ... */ }
```

**SCHEMA_SHAPE_WITH_OPTIONAL_DESCRIBE:**

```ts
// SOURCE: lib/agent-schemas.ts:50-62
// 加新字段照这个模板：optional + describe（让 LLM 知道何时填）
personaId: z
  .enum(XUEWEN_PERSONA_IDS)
  .optional()
  .describe('虚拟人物原型 id；6 个候选：…—— 决定使用页头像和全身像（来自素材目录）'),
```

**IMAGE_PICKER_SELECTED_STATE:**

```tsx
// SOURCE: components/AssetPicker/PersonaPicker.tsx:18-66
// 加 [AI 生成] tile 用同一种"selected = 蓝边 + 浅蓝底 + 圆形头像"
<button
  className="flex flex-col items-center gap-1.5 rounded-md border bg-white p-2.5"
  style={{
    borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
    background: selected ? 'var(--color-primary-bg)' : '#fff',
    boxShadow: selected ? '0 0 0 2px var(--color-primary-bg)' : 'none',
  }}
>
```

**API_ROUTE_RUNTIME_AND_KEY_CHECK:**

```ts
// SOURCE: app/api/xuewen-chat/route.ts:1-37
// 新 /api/generate-persona 用同一套：runtime nodejs / 校验 key & body / 错误返字符串
export const runtime = 'nodejs';
export const maxDuration = 60;

if (!process.env.OPENROUTER_API_KEY) {
  return new Response('OPENROUTER_API_KEY missing', { status: 500 });
}
```

**USE_PAGE_GREETING_PATTERN:**

```tsx
// SOURCE: components/XuewenUsePage.tsx:60-75
// 改造点：把硬编码 text 换成 `cfg.coldStart ?? fallback`
const initialMessages: UIMessage[] = useMemo(() => [{
  id: 'sys-greet',
  role: 'assistant',
  parts: [{ type: 'text', text: `你好！我是${name}。你想跟我聊点什么？` }],
} as UIMessage], [name]);
```

**FIELD_PATTERN:**

```tsx
// SOURCE: components/AgentForm/Field.tsx:10-23 + Xuewen.tsx:47-56
// 新加"开场白"字段照这个写
<Field label="开场白" hint="使用页第一句 · AI 会按角色风格预填，可改">
  <textarea
    className={TEXTAREA_CX}
    style={INPUT_STYLE}
    value={value.coldStart ?? ''}
    onChange={e => set('coldStart', e.target.value)}
    rows={3}
    placeholder="例：你好同学们！我是爱因斯坦，今天我们聊聊相对论…"
  />
</Field>
```

---

## Files to Change

| File | Action | Justification |
|------|------|------|
| `lib/agent-schemas.ts` | UPDATE | 三个 schema 加 `coldStart`；XuewenSchema 加 `personaCustom` 子对象；统一默认 scaffolds 文案 |
| `lib/agents/create-unified.ts` | UPDATE | instructions 加新字段填法；约束"先调 tool，前端确认；用户改主意再调一次"；提到 personaCustom 触发条件 |
| `lib/agents/create-xuewen.ts` | UPDATE | 同步 instructions（新字段）；模板路径走的是这个 |
| `lib/agents/create-debate.ts` | UPDATE | 同步：加 coldStart 默认填法（"今天我们辩论…"模板） |
| `lib/agents/create-discussion.ts` | UPDATE | 同步 + 修 6 条 scaffolds 与 Discussion.tsx 默认对齐 |
| `components/AgentCreatePage.tsx` | UPDATE | 把 `useEffect` 自动应用改为"待用户点[应用]"；多版草稿支持（用 `Set<applied toolCallId>`）；传 `applyDraft` 给 ChatArea |
| `components/ChatArea.tsx` | UPDATE | tool input-available 分支：从单行 ✓ 标 → 富确认卡 + 按钮回调 |
| `components/AgentForm/Xuewen.tsx` | UPDATE | 加"开场白"Field；PersonaPicker 嵌入"AI 生成形象"分支（用 personaCustom 时显示生成中/已生成预览） |
| `components/AgentForm/Debate.tsx` | UPDATE | 加"开场白"Field |
| `components/AgentForm/Discussion.tsx` | UPDATE | 加"开场白"Field + 修 default scaffolds（与 instructions 一致） |
| `components/AssetPicker/PersonaPicker.tsx` | UPDATE | 第 7 个 tile："✨ AI 生成形象" — 触发外部回调（不直接调 API）|
| `lib/asset-catalog.ts` | UPDATE | 扩展 `getXuewenPersona` 兜底：catalog 优先 → custom (avatarUrl / roleUrl) |
| `components/RoleCard.tsx` | UPDATE | `avatarUrl` / `roleUrl` 已支持外部传值；走 catalog→custom 兜底无需改组件 — 只改调用处 |
| `components/XuewenUsePage.tsx` | UPDATE | initialMessages 读 `cfg.coldStart`；persona 取图改走 helper（兜底 custom）|
| `components/DebateUsePage.tsx` | UPDATE | 辩题条下方加"赛前提示词"区（读 `cfg.coldStart`）|
| `app/api/generate-persona/route.ts` | CREATE | POST { name, traits } → { avatarDataUrl, roleDataUrl }; 走 OpenAI dall-e-3 / gpt-image-1（独立 OPENAI_API_KEY，OpenRouter 不稳定）|
| `lib/openai-image.ts` | CREATE | 封装 `createOpenAI({ apiKey })` + `generateImage` 调用；返回 base64 → data URL |
| `components/AgentForm/AiPersonaGen.tsx` | CREATE | 小组件：包住 [✨ AI 生成形象] 按钮 + 进度态 + 双图预览；调 `/api/generate-persona` |

**说明 — 不动的文件：**

- `app/api/create-agent/route.ts` 不动 — 它只是调度 ToolLoopAgent，不感知字段 shape
- `app/api/agents/route.ts` 不动 — 它原样存 `config: Record<string, unknown>` 进 KV
- `lib/agent-storage.ts` 不动 — 配置载体是泛 record；新字段透明
- `components/AgentTemplateCreatePage.tsx` 不动 — 仅 `/create` (unified) 入口本期升级；模板路径下期再说
- 新 `DiscussionUsePage` 不建 — 当前讨论使用页是 legacy，本期 schema 准备好即可

---

## NOT Building (Scope Limits)

- **不引入 `addToolOutput` 回流** — HITL 是纯客户端"是否应用"，不写回 tool result（保持现有 client-side tool 自动 stop 的契约）
- **不为辩论 actor 加 AI 生成图** — 4 个 catalog actor 已覆盖正反/AI/学生四象限；scope 仅 学问 personaCustom
- **不做 cold-start 多轮种子（只 1 句）** — `coldStart: string` 一句够；多轮种子下期再说
- **不做生成的图片持久化到对象存储** — base64 data URL 直接进 KV agent.config（图小、KV 容许）；下期再换 blob storage
- **不修使用页布局** — 仅替换"开场白文案来源"（硬编码 → cfg.coldStart）
- **不动 AgentTemplateCreatePage** — 模板路径 `/create/[kind]` 已删（git status 显示 `D app/create/[kind]/page.tsx`），不在本期范围
- **不改 KV schema 或 SavedAgent type** — 配置项仍是 `Record<string, unknown>`，新字段是结构化扩展，旧记录无 coldStart 时 fallback 即可
- **不引入 sendAutomaticallyWhen** — 我们走 client-side 单 tool，不需要自动续聊
- **不做 cold-start 的多轮"剧本"** — 留给后续

---

## Step-by-Step Tasks

按依赖顺序执行；每个任务原子可独立验证。

### Task 1: UPDATE `lib/agent-schemas.ts`

- **ACTION**: 给三个 schema 加 `coldStart` optional 字段；给 `XuewenAgentSchema` 加 `personaCustom` 子对象
- **IMPLEMENT**:
  ```ts
  // 1) 公共字段（在三个 schema 内分别加）
  coldStart: z
    .string()
    .optional()
    .describe('使用页开场白（assistant 第一条消息）；80-120 字，与角色风格一致'),

  // 2) Xuewen 专属（在 XuewenAgentSchema 加）
  personaCustom: z
    .object({
      avatarUrl: z.string().describe('512×512 头像 url（可为 data: URL）'),
      roleUrl: z.string().describe('1024×1536 全身像 url'),
      sourcePrompt: z.string().optional().describe('生成时所用 prompt，便于复现'),
    })
    .optional()
    .describe('当 personaId 不在 6 人 catalog 时，AI 生成的人物形象；与 personaId 互斥（同时存在以 personaId 为准）'),
  ```
- **MIRROR**: `lib/agent-schemas.ts:50-62` (existing optional fields + describe)
- **GOTCHA**: 用 `zod` v4；继续用 `z.optional()` 不要写 `.nullable()`（与 catalog enum 对齐）。`personaCustom.avatarUrl` 不做 `.url()` 校验——data: URL 会被普通 URL 检验拒掉。
- **VALIDATE**: `npx tsc --noEmit` ；零错

### Task 2: UPDATE `components/AgentForm/Discussion.tsx` default scaffolds 文案 → 与 unified/discussion instructions 对齐

- **ACTION**: 修 `DEFAULT_SCAFFOLDS` 数组让它跟 `lib/agents/create-unified.ts:46-51` 一致
- **IMPLEMENT**:
  ```ts
  const DEFAULT_SCAFFOLDS = [
    { label: '① 提出新观点', template: '我的观点是<空>，依据是<空>' },
    { label: '② 补充观点',   template: '我赞同<同学名>，并补充：<空>' },
    { label: '③ 反驳观点',   template: '我不同意<同学名>，因为：<空>' },
    { label: '④ 提问澄清',   template: '我想问<同学名>：<空>' },
    { label: '⑤ 总结归纳',   template: '目前我们达成的共识是：<空>；分歧是：<空>' },
    { label: '⑥ 联系实际',   template: '在我自己的生活中，<空>' },
  ];
  ```
- **MIRROR**: `lib/agents/create-unified.ts:46-51`
- **GOTCHA**: 一定要全六条都改；`scaffolds.length === 6` 是 schema 硬约束（`agent-schemas.ts:144`）。
- **VALIDATE**: `npx tsc --noEmit`

### Task 3: UPDATE `lib/agents/create-unified.ts` instructions

- **ACTION**: 把"工作流程"补两条；把字段清单加 `coldStart`；说明 `personaCustom` 触发条件
- **IMPLEMENT**: 在 INSTRUCTIONS 内追加：
  ```
  ## 新增字段（三类共用）
  - coldStart：使用页第一条 assistant 消息。80-120 字。要符合角色（学问→第一人称介绍 + 邀请提问；辩论→主持人开场宣布辩题、双方简介；讨论→主持人开场抛主题 + 鼓励发言）。

  ## AI 学问 · 人物形象
  - 用户提到的人物在 6 人 catalog（newton/curie/darwin/socrates/galileo/tong-dizhou）内 → 填 personaId
  - 不在 catalog（如 爱因斯坦/特斯拉/居里夫人之外的人）→ **不要**填 personaId；改填 personaCustom：{ avatarUrl: '', roleUrl: '', sourcePrompt: '一句描述形象的中文 prompt（含人物名+性别+年龄+服饰+背景元素）' }
  - personaCustom.avatarUrl / roleUrl 留空——前端会接管生成，把生成结果回填
  ```
- **MIRROR**: `lib/agents/create-unified.ts:10-52` (existing INSTRUCTIONS shape)
- **GOTCHA**: 不要让 LLM 自己调 image-gen——LLM 没有这个 tool；前端接管。
- **VALIDATE**: `npx tsc --noEmit`

### Task 4: UPDATE `lib/agents/create-xuewen.ts` / `create-debate.ts` / `create-discussion.ts` instructions

- **ACTION**: 同样把 `coldStart` 写进字段清单 + 风格示范；create-xuewen 加 personaCustom 触发；create-discussion 修 default scaffolds 6 条与 Discussion.tsx 对齐
- **IMPLEMENT**: 三个文件分别在 INSTRUCTIONS 末尾加一节"## 开场白"和（仅 xuewen）"## 形象兜底"
- **MIRROR**: `lib/agents/create-xuewen.ts:12-29` (existing instruction shape)
- **GOTCHA**: 三个 instructions 是 single-tool agent；保持各自约束独立，不要交叉提"另一类"
- **VALIDATE**: `npx tsc --noEmit`

### Task 5: CREATE `lib/openai-image.ts`

- **ACTION**: 封装 OpenAI 直连 image gen；不复用 deepseek（OpenRouter 不一定支持 image）
- **IMPLEMENT**:
  ```ts
  import { createOpenAI } from '@ai-sdk/openai';
  import { generateImage } from 'ai';

  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    // 不设 baseURL — 走 api.openai.com（image-gen 在 OpenRouter 上不稳）
  });

  export async function generatePersonaImages(
    namePromptZh: string,
  ): Promise<{ avatarDataUrl: string; roleDataUrl: string; sourcePrompt: string }> {
    const sourcePrompt = `${namePromptZh} | 教科书插画风 | 暖色纸调 | 中性背景 | 无文字`;

    // 头像 1024×1024（OpenAI gpt-image-1 / dall-e-3 不支持 512）
    const avatar = await generateImage({
      model: openai.image('gpt-image-1'),
      prompt: `${sourcePrompt} | 半身肖像 | 居中`,
      size: '1024x1024',
    });

    // 全身像 1024×1536
    const role = await generateImage({
      model: openai.image('gpt-image-1'),
      prompt: `${sourcePrompt} | 全身像 | 站立`,
      size: '1024x1536',
    });

    return {
      avatarDataUrl: `data:image/png;base64,${avatar.image.base64}`,
      roleDataUrl:   `data:image/png;base64,${role.image.base64}`,
      sourcePrompt,
    };
  }
  ```
- **MIRROR**: `lib/deepseek.ts:1-17`（同一种 createOpenAI 风格）+ `node_modules/ai/docs/03-ai-sdk-core/35-image-generation.mdx:38-48`
- **GOTCHA**:
  - `gpt-image-1` 仅返回 base64，不返回 url；OK，data URL 直接进 KV
  - `dall-e-3` 也行但贵 / 较慢；用 gpt-image-1 default
  - 需新增 env `OPENAI_API_KEY`；缺时由 route 拦截报错
  - **不要**在这里 throw — 让 route handler 决定 status code
- **VALIDATE**: `npx tsc --noEmit`

### Task 6: CREATE `app/api/generate-persona/route.ts`

- **ACTION**: POST { name, traits } → 调 `generatePersonaImages` → 返 JSON
- **IMPLEMENT**:
  ```ts
  import { NextResponse } from 'next/server';
  import { generatePersonaImages } from '@/lib/openai-image';

  export const runtime = 'nodejs';
  export const maxDuration = 60;

  export async function POST(req: Request) {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY missing — set it to enable AI persona generation' },
        { status: 500 },
      );
    }
    let body: { name?: string; traits?: string };
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const traits = body.traits?.trim() ?? '科学家';

    try {
      const result = await generatePersonaImages(`${name}（${traits}）`);
      return NextResponse.json(result);
    } catch (e) {
      console.error('generate persona failed', e);
      return NextResponse.json({ error: 'image gen failed' }, { status: 502 });
    }
  }
  ```
- **MIRROR**: `app/api/agents/route.ts:19-40` 的错误处理风格
- **GOTCHA**: `runtime = 'nodejs'` 必填——`@ai-sdk/openai` image gen 在 edge runtime 部分功能不可
- **VALIDATE**: 启动 dev server，本地 `curl -X POST localhost:3001/api/generate-persona -d '{"name":"爱因斯坦"}'` —— 应返回 200 + 两个 data URL（≥ 50 KB）；没 key 时 500

### Task 7: CREATE `components/AgentForm/AiPersonaGen.tsx`

- **ACTION**: 可复用小组件，包住 [✨ AI 生成形象] 按钮 + loading + 双图预览
- **IMPLEMENT**:
  ```tsx
  'use client';
  import { useState } from 'react';
  import { useToast } from '../Toast';

  interface Props {
    name: string;                     // 用 form 内的 name
    traits?: string;                  // 用 form 内的 background 头一句
    value?: { avatarUrl: string; roleUrl: string; sourcePrompt?: string };
    onChange: (v: Props['value']) => void;
  }

  export function AiPersonaGen({ name, traits, value, onChange }: Props) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    async function gen() {
      if (!name) { toast('先填名称'); return; }
      setLoading(true);
      try {
        const res = await fetch('/api/generate-persona', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, traits }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          toast(`生成失败：${j.error ?? res.statusText}`);
          return;
        }
        const { avatarDataUrl, roleDataUrl, sourcePrompt } = await res.json();
        onChange({ avatarUrl: avatarDataUrl, roleUrl: roleDataUrl, sourcePrompt });
        toast('已生成 AI 形象，可在头像/全身像处预览');
      } catch (e) {
        console.error(e);
        toast('生成失败：网络错误');
      } finally {
        setLoading(false);
      }
    }

    return (
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={gen}
          disabled={loading || !name}
          className="rounded-md border bg-white px-3 py-1.5 text-[12px] disabled:opacity-50"
          style={{ borderColor: 'var(--color-paper-edge)' }}
        >
          {loading ? '生成中…' : '✨ AI 生成形象'}
        </button>
        {value && (
          <div className="flex gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.avatarUrl} alt="头像" className="h-12 w-12 rounded-full object-cover" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.roleUrl} alt="全身像" className="h-16 w-12 rounded-md object-cover object-top" />
          </div>
        )}
      </div>
    );
  }
  ```
- **MIRROR**: `components/AgentCreatePage.tsx:131-166` (fetch + toast pattern)
- **GOTCHA**: 双 64KB 的 data URL 不会导致 React DOM 抗议；可上 base64 png 直接 `<img src=>`。
- **VALIDATE**: `npx tsc --noEmit`

### Task 8: UPDATE `components/AssetPicker/PersonaPicker.tsx`

- **ACTION**: 在 6 个 catalog tile 之后追加一个特殊 tile：当 `value === '__custom'` 时（或外部传 customPreview）显示已生成预览；点击触发外部 `onPickCustom` 回调
- **IMPLEMENT**: 增加 props `onPickCustom?: () => void` + `customPreview?: { avatarUrl: string }`；末位 tile：
  ```tsx
  {/* 7 号 tile：AI 生成 */}
  <button
    type="button"
    onClick={() => onPickCustom?.()}
    className="..."
    style={{ borderColor: customPreview ? 'var(--color-primary)' : 'var(--color-border)' }}
  >
    <div className="..." style={{ width: 56, height: 56 }}>
      {customPreview?.avatarUrl ? (
        <img src={customPreview.avatarUrl} alt="AI 生成" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[20px]">✨</span>
      )}
    </div>
    <span className="text-[13px]">AI 生成</span>
    <span className="text-[10.5px]">不在 6 人 catalog 时</span>
  </button>
  ```
- **MIRROR**: `components/AssetPicker/PersonaPicker.tsx:18-66`
- **GOTCHA**: 不要直接在 PersonaPicker 里 fetch /api/generate-persona — 它不知道 form 的 name/traits；让外部组件触发
- **VALIDATE**: `npx tsc --noEmit`

### Task 9: UPDATE `components/AgentForm/Xuewen.tsx`

- **ACTION**: 在"人物形象"Field 下加 `<AiPersonaGen>`；新加"开场白"Field
- **IMPLEMENT**:
  ```tsx
  // 1) 人物形象旁加 AI 生成
  <Field label="人物形象" hint="6 个 catalog · 不在的话 AI 生成">
    <PersonaPicker
      value={value.personaId}
      onChange={v => set('personaId', v as XuewenAgentConfig['personaId'])}
      customPreview={value.personaCustom ? { avatarUrl: value.personaCustom.avatarUrl } : undefined}
      onPickCustom={() => { /* no-op；外部 AiPersonaGen 触发 */ }}
    />
    <AiPersonaGen
      name={value.name ?? ''}
      traits={(value.background ?? '').slice(0, 80)}
      value={value.personaCustom}
      onChange={pc => onChange({ ...value, personaCustom: pc, personaId: pc ? undefined : value.personaId })}
    />
  </Field>

  // 2) 开场白 Field（角色背景下面）
  <Field label="开场白" hint="使用页第一句 · AI 已按角色预填">
    <textarea
      className={TEXTAREA_CX} style={INPUT_STYLE}
      value={value.coldStart ?? ''}
      onChange={e => set('coldStart', e.target.value)}
      rows={3}
      placeholder="例：你好同学们！我是爱因斯坦，今天我们聊聊相对论…"
    />
  </Field>
  ```
- **MIRROR**: `components/AgentForm/Xuewen.tsx:22-56`
- **GOTCHA**: 选择了 personaCustom 时把 personaId 清空（互斥）
- **VALIDATE**: `npx tsc --noEmit`

### Task 10: UPDATE `components/AgentForm/Debate.tsx` & `Discussion.tsx`

- **ACTION**: 加"开场白"Field（位置：辩论在"辩题背景"下面；讨论在"主持风格"下面）
- **IMPLEMENT**: 同 Task 9 第 (2) 段，placeholder 按类型改：
  - 辩论："今天的辩题是…，由 AI 主持；正方主张…，反方主张…"
  - 讨论："欢迎来到讨论时间，今天我们围绕…展开"
- **MIRROR**: `components/AgentForm/Xuewen.tsx:47-56`
- **VALIDATE**: `npx tsc --noEmit`

### Task 11: UPDATE `lib/asset-catalog.ts`

- **ACTION**: 加 `getXuewenPersonaResolved(cfg)` helper：catalog 优先 → custom 兜底；返回统一的 `{ avatarUrl, roleUrl, label }`
- **IMPLEMENT**:
  ```ts
  export function getXuewenPersonaResolved(cfg: {
    personaId?: string;
    personaCustom?: { avatarUrl: string; roleUrl: string };
    name?: string;
  }): { avatarUrl?: string; roleUrl?: string; label?: string } {
    if (cfg.personaId) {
      const p = getXuewenPersona(cfg.personaId);
      if (p) return { avatarUrl: p.avatar, roleUrl: p.role, label: p.label };
    }
    if (cfg.personaCustom) {
      return {
        avatarUrl: cfg.personaCustom.avatarUrl,
        roleUrl:   cfg.personaCustom.roleUrl,
        label:     cfg.name,
      };
    }
    return {};
  }
  ```
- **MIRROR**: `lib/asset-catalog.ts:212-215`（getXuewenPersona 风格）
- **GOTCHA**: 不要去掉旧的 `getXuewenPersona` — 还有别处在用
- **VALIDATE**: `npx tsc --noEmit`

### Task 12: UPDATE `components/XuewenUsePage.tsx`

- **ACTION**:
  1. 用 `getXuewenPersonaResolved` 替换 `getXuewenPersona` + `getBackground` 的取图
  2. `initialMessages` 用 `cfg.coldStart ?? \`你好！我是${name}。你想跟我聊点什么？\``
- **IMPLEMENT**:
  ```tsx
  import { getXuewenPersonaResolved, getBackground } from '@/lib/asset-catalog';
  // ...
  const persona = getXuewenPersonaResolved(cfg);
  const bg = getBackground('xuewen', cfg.bgAsset);
  // 在 RoleCard 调用处：
  <RoleCard ... avatarUrl={persona.avatarUrl} roleUrl={persona.roleUrl} ... />

  // initialMessages:
  const greeting = cfg.coldStart?.trim() || `你好！我是${name}。你想跟我聊点什么？`;
  ```
- **MIRROR**: `components/XuewenUsePage.tsx:60-82`
- **GOTCHA**: cfg.coldStart 可能是空串 `""` —— 用 `.trim() || fallback`
- **VALIDATE**: `npx tsc --noEmit`；启动 dev 验证：catalog 人物（牛顿）正常显示头像；自定义人物（Form 里走 [✨ AI 生成]）头像也显示

### Task 13: UPDATE `components/DebateUsePage.tsx`

- **ACTION**: 在辩题条下方插一条"主持开场"消息（只在 cfg.coldStart 存在时渲染）
- **IMPLEMENT**: 在 `<div>{/* 辩题条 */}</div>` 之后，`<div>{/* 轮次进度 */}</div>` 之前加：
  ```tsx
  {cfg.coldStart?.trim() && (
    <div
      className="mb-4 flex gap-3 rounded-md border-l-4 bg-white px-4 py-3"
      style={{ borderLeftColor: 'var(--color-debate)', borderColor: 'var(--color-paper-edge)' }}
    >
      <span className="font-numeric text-[12px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--color-debate)' }}>
        OPENING
      </span>
      <p className="flex-1 text-[13.5px] leading-relaxed"
         style={{ color: 'var(--color-ink-1)' }}>
        {cfg.coldStart}
      </p>
    </div>
  )}
  ```
- **MIRROR**: 风格按 `.impeccable.md` "errata 勘误条"模式（左侧色边 + smcp 标签）
- **GOTCHA**: cfg.coldStart 不存在时不渲染（保持向后兼容）
- **VALIDATE**: 启动 dev 验证：seed 'seed-ai-judgement' 没 coldStart → 不显示此条；新建带 coldStart 的辩论 → 显示

### Task 14: UPDATE `components/AgentCreatePage.tsx` + `components/ChatArea.tsx` (HITL 二段确认)

这是核心改动，分两半：

#### 14a: UPDATE `components/ChatArea.tsx`

- **ACTION**: tool input-available 分支换成富卡片 + 接收外部 onApply / onDismiss 回调
- **IMPLEMENT**:
  ```tsx
  interface Props {
    messages: UIMessage[];
    isStreaming?: boolean;
    appliedToolCallId?: string | null;          // 已应用的 toolCallId
    onApplyDraft?: (kind: CreateKind, toolCallId: string, input: unknown) => void;
  }

  // input-available 分支：
  if (part.state === 'input-available' && part.input && part.toolCallId) {
    const isApplied = part.toolCallId === appliedToolCallId;
    const summary = summarizeDraft(kind, part.input);  // 新 helper
    return (
      <div key={part.toolCallId} className="self-start ml-[44px] max-w-[640px] rounded-md border"
           style={{ background: 'var(--color-paper-card)', borderColor: 'var(--color-paper-edge)' }}>
        <div className="flex items-center gap-2 border-b px-4 py-2 text-[12px] font-numeric uppercase tracking-[0.14em]"
             style={{ borderColor: 'var(--color-paper-rule)', color: 'var(--color-ink-3)' }}>
          <span>{CREATE_KIND_LABEL[kind]} 草稿</span>
          {isApplied && <span style={{ color: 'var(--color-launch-deep)' }}>· 已应用</span>}
        </div>
        <div className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: 'var(--color-ink-1)' }}>
          {summary}
        </div>
        {!isApplied && (
          <div className="flex gap-2 border-t px-4 py-2.5"
               style={{ borderColor: 'var(--color-paper-rule)' }}>
            <button
              onClick={() => onApplyDraft?.(kind, part.toolCallId!, part.input)}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
              style={{ background: 'var(--color-paper-stamp)' }}
            >
              应用到表单
            </button>
            <span className="text-[12px]" style={{ color: 'var(--color-ink-3)' }}>
              （或继续在下方对话框跟我说要改什么）
            </span>
          </div>
        )}
      </div>
    );
  }
  ```
- **MIRROR**: `components/ChatArea.tsx:178-219`
- **GOTCHA**:
  - `summarizeDraft` 是新 helper（同文件顶层），输入按 kind 输出 1-3 行字段摘要
  - "重新生成"按钮先**不实现**——用户可在 chat 输入框里说"再来一版"，不用按钮
- **VALIDATE**: `npx tsc --noEmit`

#### 14b: UPDATE `components/AgentCreatePage.tsx`

- **ACTION**: 删掉自动 useEffect 应用；改成 onApplyDraft 回调里 setFormState
- **IMPLEMENT**:
  ```tsx
  // 删除：
  useEffect(() => {
    const call = findLatestCreateCall(messages);
    if (call && call.id !== lastApplied) { /* ... */ }
  }, [messages, lastApplied, toast]);

  // 替换为 onApplyDraft handler:
  function handleApplyDraft(kind: CreateKind, toolCallId: string, input: unknown) {
    setCurrentKind(kind);
    setFormState(input as AnyConfig);
    setLastApplied(toolCallId);
    toast(`已应用 ${CREATE_KIND_LABEL[kind]} 草稿到右侧表单`);
  }

  // 把 handler 传给 ChatArea:
  <ChatArea
    messages={messages}
    isStreaming={isStreaming}
    appliedToolCallId={lastApplied}
    onApplyDraft={handleApplyDraft}
  />
  ```
- **MIRROR**: `components/AgentCreatePage.tsx:91-123` 的 state shape 不变；只是触发时机从 effect 换成回调
- **GOTCHA**:
  - 保留 `lastApplied` state（现在叫 "已应用的 toolCallId"），用于卡片 isApplied 状态显示
  - `findLatestCreateCall` 函数留着但不再被 useEffect 调用——可以删；或保留给将来"自动滚动到最新草稿"用。本期删掉，避免死代码。
  - 多次草稿支持：用户继续聊→AI 出新版→新卡片显示，旧卡片仍显示 [已应用]/无；用户可点新卡片的 [应用到表单] 覆盖
- **VALIDATE**:
  1. `npx tsc --noEmit`
  2. 启动 dev：在 `/create` 输入"三年级讲磁铁的牛顿"→ chat 出现卡片 → 右栏仍空态 → 点 [应用到表单] → 右栏出表单 → 卡片显示 [已应用]
  3. 输入"再做一个达尔文"→ 第二张卡片出现 → 右栏仍是牛顿 → 点新卡 [应用] → 右栏切达尔文

---

## Testing Strategy

### 手动 QA 清单（本项目无单元测试）

| 场景 | 步骤 | 期望 |
|------|------|------|
| HITL 不自动展开 | `/create` → 输入"三年级牛顿讲磁铁" → 等流式结束 | 右栏依旧"等 AI 判断类型"；chat 中出现确认卡 |
| HITL 应用 | 上一步 → 点卡片 [应用到表单] | 右栏 ⏯ 渲染填好的 XuewenForm；卡片变 [已应用] |
| 多版草稿 | 应用后再说"换成达尔文" → 等出新卡片 | 出第二张卡片；右栏仍是牛顿；点新卡 → 右栏切达尔文 |
| Catalog 人物 | 输入"牛顿" → 应用 | personaId='newton'；6 选 1 grid 第 1 格选中；AiPersonaGen 不显示预览 |
| 非 catalog 人物 - AI 生成 | 输入"爱因斯坦讲相对论" → 应用 → 表单里点 [✨ AI 生成形象] | 进度态 → 头像/全身像出现 → 头像 picker 第 7 格 (AI) 选中；保存后 KV 含 personaCustom |
| 非 catalog - 不生成 | 输入"特斯拉" → 应用 → 不点生成 → 直接保存 | 保存成功；进 use 页头像降级首字符（沿用现状） |
| 冷启动 - 学问 | 应用 + 保存 → 进 `/use/xuewen/[id]` | assistant 第一条是 cfg.coldStart（如"你好！我是牛顿…"），不是硬编码 |
| 冷启动 - 学问回退 | 应用一个 coldStart 为空的草稿 → 保存 → 进 use 页 | 第一条仍是 fallback `你好！我是${name}。你想跟我聊点什么？` |
| 冷启动 - 辩论 | 输入"塑料禁令辩论" → 应用 → 保存 → 进 `/use/debate/[id]` | 辩题条下方显示 OPENING 提示条；无 coldStart 时不显示 |
| Discussion default scaffolds | 在 unified 上输入"班级讨论保护环境" → 应用 | scaffolds 6 条与 instructions 一致；不再 drift |
| 缺 OPENAI_API_KEY | unset key → 点 [✨ AI 生成形象] | toast 显示 `OPENAI_API_KEY missing — set it…`；表单不卡死 |
| 错误恢复 | 模拟 502 → 点 [生成] | toast 显示 "生成失败：…"；按钮重新可点 |

### Edge Cases Checklist

- [ ] 用户连续点两次 [应用到表单]：第二次应是 no-op（已 applied）
- [ ] coldStart 是 `"   "` 空格串：fallback 必须 trim 比对
- [ ] personaCustom 与 personaId 同时存在：取 personaId（在 `getXuewenPersonaResolved` 已实现）
- [ ] 多版草稿但都没应用：右栏空态保持，不抢先展开
- [ ] 旧 SavedAgent (KV 里没 coldStart 字段)：use 页 fallback 不报错
- [ ] data URL 长度（约 1-1.5MB）写 KV：不超 Vercel KV 单 key 上限（10MB）
- [ ] generate-persona 30s+ 超时：route 用 `maxDuration = 60`，前端 toast 应等够
- [ ] 旧 unified instructions 不会再让 LLM 调那个错的 default scaffolds（覆盖一遍即可）

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
npx tsc --noEmit
```

**EXPECT**: Exit 0；零 type error

（项目无 lint 配置；`package.json` 没 lint 脚本）

### Level 2: BUILD

```bash
npx next build
```

**EXPECT**: Exit 0；无 build error；新 route `/api/generate-persona` 列入 build output

### Level 3: DEV_SMOKE

```bash
npx next dev   # 在另一终端，不要后台跑
# 然后在浏览器访问 http://localhost:3001/create
```

**EXPECT**: 页面渲染；左对话栏 + 右"等 AI 判断类型"空态

### Level 4: MANUAL_E2E（按 Testing Strategy 表）

完成上表所有"期望"列。

### Level 5: KV ROUND-TRIP

无 KV 凭证：使用 mem fallback；保存的 agent.config 包含 coldStart / personaCustom；getAgent 取回字段一致。

### Level 6: 大屏 1m / 桌面 30cm

- 草稿确认卡：1m 投影距离能读清字段摘要（≥14px）
- AI 生成头像：1m 距离辨识度（圆头像至少 56px）

---

## Acceptance Criteria

- [ ] `/create` 不再因 tool-input-available 自动填充右栏
- [ ] 草稿确认卡渲染、[应用到表单] 按钮工作；多版草稿可叠
- [ ] 三个 schema 都有 `coldStart` 字段；XuewenSchema 有 `personaCustom`
- [ ] AI 生成的 cold-start 文案合理（80-120 字、贴角色风格）
- [ ] PersonaPicker 第 7 格 [AI 生成] 工作；调 `/api/generate-persona` 返回双图 data URL
- [ ] XuewenUsePage 开场白用 cfg.coldStart；fallback 沿用旧硬编码
- [ ] DebateUsePage 显示开场提示条（cfg.coldStart 存在时）
- [ ] DiscussionForm default scaffolds 与 unified instructions 文案一致
- [ ] `npx tsc --noEmit` 0 错；`npx next build` 通过
- [ ] 所有 Edge Cases Checklist 项核对过
- [ ] 旧已保存 agent（无 coldStart / personaCustom）在 use 页继续工作

---

## Completion Checklist

- [ ] Task 1-14 按依赖顺序完成
- [ ] 每个 Task 完成后立刻 `npx tsc --noEmit`
- [ ] 终态：Level 1-3 全过，Level 4 表过半（核心 8 项）以上
- [ ] 全部 Acceptance Criteria 勾上
- [ ] 一次 dev 重启 + manual E2E（创建一个 catalog 人物 + 一个 AI 生成人物，分别保存进入 use 页验证开场白）

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------|------|------|
| OPENAI_API_KEY 缺失 / OpenAI image 计费高 | HIGH | MEDIUM | route 校验 key 缺失返 500；前端 toast 提示；用户可不点 [生成] 按钮，仍走 catalog 流程 |
| dall-e-3 / gpt-image-1 中文人物理解差（爱因斯坦画成华人） | MEDIUM | MEDIUM | sourcePrompt 用英文 transliteration（"Albert Einstein"）+ 兜底 prompt；用户可改 prompt 重生（v2 加） |
| data URL 写 KV 超限 | LOW | HIGH | base64 png ~1MB；KV 单值限 10MB；够；监控 |
| 多版草稿 UX 混乱（用户搞不清"哪张是 active"）| MEDIUM | LOW | 卡片头部 [已应用] 标识；toast 明示"已应用…草稿"；本期不做"撤销" |
| ai-sdk v6 generateImage API 与本地 docs 微差 | LOW | MEDIUM | docs 来自 node_modules 同版本；如有差异回退用 `experimental_generateImage` 别名 |
| Discussion form scaffolds drift 复发 | MEDIUM | LOW | Task 2 + Task 4 同时改；评审时把两处一起 diff |
| 用户点 [应用] 后再删掉 form 字段 → 失去 AI 草稿 | LOW | LOW | 用户可在对话框里说"恢复刚才那版"，AI 重发 → 再点 [应用]；本期接受 |
| HITL 卡过宽撑爆 86% 行内宽度 | LOW | LOW | maxWidth 640px；超长字段摘要截断（用 line-clamp-2）|

---

## Notes

- **为何不用 `addToolOutput` 做确认**：client-side tool 无 execute 已让 ToolLoopAgent 自动 stop；再 addToolOutput 会让 agent 重新进 loop 一次，浪费 token。HITL 在我们这里就是"客户端是否把 input 写进 form 的本地决策"，不需要回流。
- **为何不存 catalog 人物预生成的 description**：6 张是固定 catalog；description 由 instructions 引导 LLM 自填进 `background` 字段，不需要冗余存储。
- **未来扩展**：
  - cold-start 多轮（assistant + 第一条 user 问候 stub）
  - 辩论 actor AI 生成（4 张 catalog 不够时）
  - 头像/全身像编辑（gpt-image-1 supports edit-mode）
  - 草稿回放：把每张卡片的 input 存为 history，可"返回上一版"
  - 把 personaCustom data URL 转 blob 上传，避免 KV 体积
- **设计一致性 check**（按 `.impeccable-brief.md`）：
  - 卡片用 `var(--color-paper-card)` + `var(--color-paper-edge)` ✓
  - smcp 标签 + numeric 字 ✓
  - 操作按钮用 `var(--color-paper-stamp)` 黑底 ✓
  - 不引入新阴影/渐变 ✓
- **对 Next 16 / React 19 的注意**：本期所有改动都是 client component (`'use client'`) 内的 React state；新 route 用 `runtime: 'nodejs'`、`maxDuration: 60`，与现有 `/api/xuewen-chat` 同款；`params` 不涉及。
