# Feature: AI 创建 — 单一入口 + 工具调用内联渲染为可编辑卡片

## Summary

把现有 3 路 `/create/[kind]` + 50/50 分屏（左聊右表）的智能体创建流，重构为：① 首页一颗"AI 创建"按钮 → 单一 `/create` 路由；② 全屏对话区，无常驻表单；③ 后端三个 `ToolLoopAgent` 合并为一个 `unifiedCreateAgent`（绑 `proposeXuewenAgent` / `proposeDebateAgent` / `proposeDiscussionAgent` 三个无 `execute` 的 client-side tool），由 LLM 按对话内容自动路由；④ tool call 落到前端后渲染为内联可编辑表单卡片，"确认保存"调用 `POST /api/agents`。AI 后续可以再次调用工具发新版草稿，对话历史里就多出一张卡片。

## User Story

**As a** 小学科学/AI 课教师
**I want to** 用一句自然语言描述需求（"给我一个三年级讲磁铁的牛顿"），看着配置在对话里直接长出来、就地修改、按一下确认就保存
**So that** 我不用先选「学问/辩论/讨论」分类、不用对着空表盯着填——分类是 AI 帮我做的，表单只在该出现时出现

## Problem Statement

当前 `/create/[kind]` 把分类工作外包给用户（必须先选 kind 才能开聊），右侧"配置"栏从打开就是空的、要等 AI 通过 tool call 灌入数据才有内容。出现"两个表面"的认知割裂：聊天和表单各占一边，操作焦点要在两侧来回跳。

可测试断言：
- ❌ 现在：进 `/create/xuewen`，右侧立刻看到一个空表单（即便没说一个字）
- ✅ 目标：进 `/create`，**只有一个对话区**；表单卡片在 AI 调工具的那一刻才出现在对话流里
- ✅ 目标：首页只有一颗"AI 创建"按钮（不再是 3 个分类 pill）

## Solution Statement

两条改动线：

**后端**：`lib/agents/create-{xuewen,debate,discussion}.ts` 三个文件合并为一个 `lib/agents/create-unified.ts`，输出 `unifiedCreateAgent`（一个 ToolLoopAgent + 3 个 client-side tools）。`/api/create-agent/route.ts` 删去 `kind` 参数和 switch 分支，统一喂 `unifiedCreateAgent`。

**前端**：
- 删 `app/create/[kind]/page.tsx`，新建 `app/create/page.tsx`（无参数）
- `AgentCreatePage` 改为全屏聊天 + `useChat` 不再传 `body: { kind }`
- `ChatArea.tsx` 的 parts 渲染加 `case 'tool-${TOOLNAME}'` 分支，渲染 `<InlineFormCard>`
- `InlineFormCard` 自带 local edit state（用 `part.input` 做种子）、底部"取消草稿 / 确认保存"双按钮、保存调 `POST /api/agents` → toast → `router.push('/')`
- 因为 tool 没有 `execute`，state 永远停在 `input-available`，卡片可以无限期编辑；多次 tool call = 多张卡片在历史里
- 首页 QUICK_NEW（3 pill）/ "+ 新建" / "AI 对话新建"虚框，全替换成一颗醒目的"AI 创建"按钮

## Metadata

| Field | Value |
|---|---|
| Type | REFACTOR + ENHANCEMENT |
| Complexity | MEDIUM |
| Systems Affected | 创建路由 / Chat 渲染 / 后端 agent dispatch / 首页入口 |
| Dependencies | ai@^6.0.176, @ai-sdk/react@^3.0.178, zod@^4.4.3, next@16.2.6, react@19.2.4, @vercel/kv@^3 |
| Estimated Tasks | 9 |

---

## UX Design

### Before State

```
╔══════════════════════════════════════════════════════════════════╗
║                        BEFORE STATE (现状)                       ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  首页 ────────────────────────────────────────────────            ║
║  [学问·] [辩论·] [讨论·]   ← 3 个分类 pill                        ║
║       ↓ 必须先选一个                                              ║
║                                                                   ║
║  /create/xuewen ──────────────────────────────────────            ║
║  ┌──────────────┬────────────────────────────────┐               ║
║  │              │  配置（先在左侧聊几句让 AI 生成）│  ← 右栏从打开 ║
║  │   ChatArea   │  ┌────────────────────────────┐ │     就是空表  ║
║  │              │  │ name:        [____________]│ │     直到 tool ║
║  │              │  │ background:  [____________]│ │     call 才  ║
║  │              │  │ subject:▼ grade:▼          │ │     有内容   ║
║  │   [input]    │  └────────────────────────────┘ │               ║
║  └──────────────┴────────────────────────────────┘               ║
║                                                                   ║
║  PAIN: 必须先选 kind；表单常驻空表面；操作焦点两边来回跳            ║
║  DATA: 用户输入 → useChat → /api/create-agent (kind 路由)          ║
║         → 三选一 agent → tool call → setFormState (页级单态)       ║
╚══════════════════════════════════════════════════════════════════╝
```

### After State

```
╔══════════════════════════════════════════════════════════════════╗
║                        AFTER STATE (目标)                        ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  首页 ────────────────────────────────────────────────            ║
║          [   AI 创建   ]   ← 单按钮                                ║
║                ↓ click                                            ║
║                                                                   ║
║  /create ─────────────────────────────────────────────            ║
║  ┌─────────────────────────────────────────────────┐             ║
║  │  AI: 你好，告诉我想做什么 agent                   │             ║
║  │  我: 给我个三年级讲磁铁的牛顿                     │             ║
║  │  AI: 好，给你一份 AI 学问草稿：                   │             ║
║  │  ┌──────────────────────────────────────────┐   │             ║
║  │  │ 📝 AI 学问 · 牛顿                         │   │ ← tool      ║
║  │  │ name: [牛顿]                              │   │   call      ║
║  │  │ background: [....]                        │   │   渲染成    ║
║  │  │ subject:[科学▼] grade:[三年级▼]           │   │   卡片      ║
║  │  │ ────────────────────────────────────      │   │             ║
║  │  │     [取消草稿]      [确认保存 ↗]          │   │             ║
║  │  └──────────────────────────────────────────┘   │             ║
║  │  我: 把性格改幽默一些                             │             ║
║  │  AI: 好，更新一版：                               │             ║
║  │  ┌──────────────────────────────────────────┐   │ ← 再次       ║
║  │  │ 📝 AI 学问 · 牛顿（v2）                   │   │   tool       ║
║  │  │ ...                                       │   │   call       ║
║  │  └──────────────────────────────────────────┘   │   = 新卡片   ║
║  │                                                  │             ║
║  │  [输入...]                          [发送]       │             ║
║  └─────────────────────────────────────────────────┘             ║
║                                                                   ║
║  VALUE: 描述驱动；卡片只在 AI 提议时出现；旧版自然在历史里         ║
║  DATA: 用户输入 → useChat → /api/create-agent (无 kind)            ║
║         → unifiedCreateAgent (3 tools) → LLM 自选 tool             ║
║         → tool-*-part (state=input-available)                     ║
║         → ChatArea switch(part.type) → <InlineFormCard>           ║
║         → 卡片本地 useState                                        ║
║         → POST /api/agents → router.push('/')                     ║
╚══════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|---|---|---|---|
| `app/page.tsx` QUICK_NEW | 3 个分类 pill | 1 颗"AI 创建"按钮 | 不再被强迫预选分类 |
| `app/page.tsx` "+ 新建" / "AI 对话新建" 虚框 | 都硬指 `/create/xuewen` | 都改指 `/create` | 入口归一 |
| `app/page.tsx` 已保存 agent 的"编辑"链接 | 跳 `/create/{kind}` | 暂时隐藏（无编辑流） | 见 Risks |
| `/create/[kind]` | 50/50 split + 空表常驻 | 删除 | 单一焦点 |
| `/create` | 不存在 | 全屏聊天 + 内联卡片 | 描述即所得 |
| AI 触发 tool call | 灌入右栏单表单 | 渲染成对话流里的卡片 | 上下文不分裂 |
| 多次提议 | 后一次覆盖前一次 | 多卡片并存（history 里） | 旧版可回看 |

---

## Mandatory Reading

| P | File | Lines | Why |
|---|------|-------|-----|
| P0 | `components/ChatArea.tsx` | 1-55 | 现在只渲染 text part；新增 tool-* case 必须在这里加 |
| P0 | `components/AgentCreatePage.tsx` | 1-209 | 现存 50/50 layout / `findLatestToolCall` / 单 formState 模型——全部要重构 |
| P0 | `lib/agent-schemas.ts` | full | 单一真理来源：CREATE_TOOL_NAME / 3 个 Zod schema / CreateKind 联合，**保持不变** |
| P0 | `lib/agents/create-xuewen.ts` | full | 单 tool ToolLoopAgent 范例（要合并成 1 个多 tool agent） |
| P0 | `lib/agents/create-debate.ts` | full | 同上 |
| P0 | `lib/agents/create-discussion.ts` | full | 同上 |
| P1 | `app/api/create-agent/route.ts` | full | switch dispatch 要塌成单 agent 调用 |
| P1 | `components/AgentForm/Xuewen.tsx` | full | 控制组件 prop 形状（value/onChange/Partial），InlineFormCard 内复用 |
| P1 | `components/AgentForm/Debate.tsx` | full | 同上 |
| P1 | `components/AgentForm/Discussion.tsx` | full | 同上 |
| P1 | `components/AgentForm/Field.tsx` | full | INPUT_CX / TEXTAREA_CX / SUBJECTS / GRADES — 卡片样式复用 |
| P2 | `components/Toast.tsx` | full | `useToast()` 返回 `(msg: string) => void` 直函数 |
| P2 | `app/api/agents/route.ts` | full | 保存接口已存在 `{ kind, config }`，**不改** |
| P2 | `app/page.tsx` | 100-300 | QUICK_NEW / KIND_TO_CREATE / 硬写 `/create/xuewen` 全在这里 |
| P2 | `app/globals.css` | 14-90 | color token 引用名（`--color-primary` 等） |

**External Documentation:**

| Source | Section | Why |
|---|---|---|
| [AI SDK v6 — Generative UI](https://github.com/vercel/ai/blob/main/content/docs/04-ai-sdk-ui/04-generative-user-interfaces.mdx) | "Render Tool Components in Chat Interface" | `switch(part.type)` → `case 'tool-{name}'` 渲染 React 组件的官方范式 |
| [AI SDK v6 — Chatbot Tool Usage](https://github.com/vercel/ai/blob/main/content/docs/04-ai-sdk-ui/03-chatbot-tool-usage.mdx) | "Render UI for Chatbot Tool Call States" | 状态机 4 档：`input-streaming` / `input-available` / `output-available` / `output-error` |
| [AI SDK v6 — UIMessage reference](https://github.com/vercel/ai/blob/main/content/docs/07-reference/01-ai-sdk-core/31-ui-message.mdx) | "ToolUIPart type definition" | `ToolUIPart<TOOLS>` 是按 tool 名展开的判别联合，type = `` `tool-${NAME}` `` |
| [AI SDK v6 — Agents Overview](https://github.com/vercel/ai/blob/main/content/docs/03-agents/01-overview.mdx) | "Define and use a ToolLoopAgent with multiple tools" | 多 tool ToolLoopAgent 由 LLM 按 prompt + instructions 自动路由 |
| [AI SDK v6 — Tool Invocation Missing Result](https://github.com/vercel/ai/blob/main/content/docs/09-troubleshooting/05-tool-invocation-missing-result.mdx) | "Handle Tool Results with onToolCall" | 无 `execute` = HITL；MVP **不调** `addToolOutput`；ToolLoopAgent 在 no-execute tool 处自动终止 loop（SDK docblock `node_modules/ai/dist/index.d.ts:3516-3526`） |

GOTCHA: SDK 文档明写「If there are tools that do not have execute functions, they are not included in the tool results and need to be added separately」（`node_modules/ai/dist/index.d.ts:1134-1135`）——意思是没保存前继续聊，下一轮 LLM 历史里有"未应答 tool call"。这正是我们想要的（让 AI 改主意重发新版），不是 bug。**保存后立刻 `router.push('/')` 离开页面，会话终止，问题自然消解**。

---

## Patterns to Mirror

### NAMING_CONVENTION（kebab 文件名 / camelCase 导出 / PascalCase React 组件）

```ts
// SOURCE: lib/agents/create-xuewen.ts:1
import { ToolLoopAgent, tool } from 'ai';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';

// 导出 camelCase 实例
export const createXuewenAgent = new ToolLoopAgent({ ... });
```

### TOOL_DEFINITION (无 execute = client-side / HITL)

```ts
// SOURCE: lib/agents/create-xuewen.ts:31-43
export const createXuewenAgent = new ToolLoopAgent({
  model: deepseek(DEEPSEEK_MODEL),
  instructions: INSTRUCTIONS,
  temperature: 0.5,
  tools: {
    [CREATE_TOOL_NAME.xuewen]: tool({
      description: '当 AI 学问智能体的所有必填字段...都已清晰时...',
      inputSchema: XuewenAgentSchema,
      // 无 execute = client-side tool / HITL
    }),
  },
});
```

新文件 `lib/agents/create-unified.ts` **沿用同一形状**，只是 `tools` 对象有 3 个 key：

```ts
tools: {
  [CREATE_TOOL_NAME.xuewen]:    tool({ description: '...', inputSchema: XuewenAgentSchema }),
  [CREATE_TOOL_NAME.debate]:    tool({ description: '...', inputSchema: DebateAgentSchema }),
  [CREATE_TOOL_NAME.discussion]: tool({ description: '...', inputSchema: DiscussionAgentSchema }),
}
```

### CHAT_RENDER_PATTERN (现行：只渲染 text)

```tsx
// SOURCE: components/ChatArea.tsx:5-11 — 当前 extractText 丢弃所有非 text part
function extractText(msg: UIMessage): string {
  if (!msg.parts) return '';
  return msg.parts
    .filter(p => p.type === 'text')
    .map(p => (p as { type: 'text'; text: string }).text)
    .join('');
}
```

### CHAT_RENDER_PATTERN (新：parts.map + switch)

```tsx
// PATTERN: copy from AI SDK v6 generative UI cookbook
// PROJECT-LOCALIZED FORM:
{messages.map(m => (
  <div key={m.id}>
    {m.parts?.map((part, i) => {
      if (part.type === 'text') return <TextBubble key={i} role={m.role} text={part.text} />;

      if (part.type === 'tool-proposeXuewenAgent'    ||
          part.type === 'tool-proposeDebateAgent'    ||
          part.type === 'tool-proposeDiscussionAgent') {
        if (part.state === 'input-streaming')
          return <DraftLoadingPill key={part.toolCallId} kind={kindFromType(part.type)} />;
        if (part.state === 'input-available')
          return <InlineFormCard
            key={part.toolCallId}
            toolCallId={part.toolCallId}
            kind={kindFromType(part.type)}
            initial={part.input}
          />;
      }
      return null;
    })}
  </div>
))}
```

### FORM_COMPONENT_PROPS (复用现有 3 个表单)

```ts
// SOURCE: components/AgentForm/Xuewen.tsx:6-9 (Debate/Discussion 同形)
interface Props {
  value: Partial<XuewenAgentConfig>;        // 注意是 Partial，允许部分填
  onChange: (v: Partial<XuewenAgentConfig>) => void;
}
```

### TOAST_USAGE

```ts
// SOURCE: components/Toast.tsx:35-39
export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx.show;  // 直接是 (msg: string) => void
}

// 用法: const toast = useToast(); toast('已保存');
```

### TOPBAR_USAGE (单一 /create 不再有 kind crumb)

```tsx
// SOURCE: components/Topbar.tsx:6-9
interface Props {
  crumb?: string;
  showRecordsNav?: boolean;
  right?: ReactNode;
}

// /create 用法:
<Topbar crumb="AI 创建" showRecordsNav={false} />
// 不再像 /create/xuewen 那样传 right={保存按钮}（保存按钮挪到卡片内）
```

### KEY_GOTCHA — 卡片用 toolCallId 作 key 锁定身份

```tsx
// 不能用数组 index — 新 tool call 来了会让 React 错位重置 useState
<InlineFormCard key={part.toolCallId} ... />
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `app/create/[kind]/page.tsx` | DELETE | 替换为单一 `/create`，整个 `[kind]/` 目录删 |
| `app/create/page.tsx` | CREATE | 新一级入口（无 kind 参数） |
| `components/AgentCreatePage.tsx` | REWRITE | 删 `kind` prop / 50/50 layout / lastApplied / 页级 setFormState；改成全屏聊天 |
| `components/AgentInlineFormCard.tsx` | CREATE | 内联卡片，按 kind 分发到 3 个表单，本地 useState + 保存 |
| `components/ChatArea.tsx` | MODIFY | parts.map 改成 switch；新增 tool-* case → 渲染 InlineFormCard |
| `lib/agents/create-unified.ts` | CREATE | 单 ToolLoopAgent + 3 个 client-side tools，instructions 教 LLM 路由 |
| `lib/agents/index.ts` | MODIFY | 导出 `unifiedCreateAgent`；删 `CREATE_AGENTS`（被替代） |
| `lib/agents/create-xuewen.ts` | DELETE | 被 unified 替代 |
| `lib/agents/create-debate.ts` | DELETE | 被 unified 替代 |
| `lib/agents/create-discussion.ts` | DELETE | 被 unified 替代 |
| `app/api/create-agent/route.ts` | MODIFY | 删 `kind` body + switch 分支，单 agent 调用 |
| `app/page.tsx` | MODIFY | QUICK_NEW 改"AI 创建"按钮；KIND_TO_CREATE 删；硬写 `/create/xuewen` 全改 `/create`；已保存 agent 的"编辑"按钮先隐藏 |

**保持不变** (重要 — 不要乱动):
- `lib/agent-schemas.ts` — 3 个 schema + CREATE_TOOL_NAME + CREATE_KIND_LABEL
- `app/api/agents/route.ts` — `POST { kind, config }` 已支持
- `lib/agent-storage.ts` — KV/in-mem 双轨，已就绪
- `components/AgentForm/{Xuewen,Debate,Discussion,Field}.tsx` — 表单组件直接复用
- `components/Topbar.tsx` / `Toast.tsx` / `ChatInput.tsx`
- `lib/agents/prep.ts` + `PREP_AGENTS` — 备课流程不动

---

## NOT Building (Scope Limits)

- **不**做保存后调用 `addToolOutput` 让 AI 在对话里说"已保存"——保存后直接 toast + 跳首页，会话终止
- **不**做"旧卡片自动灰化 / 折叠 / 标记 superseded"——多次 tool call 自然在 history 里堆叠，每张都可独立保存（一旦保存就 router.push 离开，多张并存只在用户连发但未保存的中间态出现）
- **不**做后端 schema 验证收紧（Zod 校验仅在 LLM tool inputSchema 处生效，`/api/agents` 仍宽松接收）
- **不**做"编辑已保存 agent"流程——首页保存 agent 卡片上的"编辑"链接先隐藏；这是另一条 PRP
- **不**做卡片状态持久化（用户刷新页面、关掉浏览器，对话历史和卡片都会丢——本来就是临时草稿态）
- **不**做 onToolCall / sendAutomaticallyWhen——纯 HITL，永远不回灌 result

---

## Step-by-Step Tasks

按依赖顺序执行。每个 task 完成立刻跑 VALIDATE。

### Task 1: CREATE `lib/agents/create-unified.ts`

- **ACTION**: 新建文件，导出单个 `unifiedCreateAgent`
- **IMPLEMENT**:
  - import `ToolLoopAgent`, `tool` from `'ai'`
  - import 3 schema + `CREATE_TOOL_NAME` from `'@/lib/agent-schemas'`
  - import `deepseek`, `DEEPSEEK_MODEL` from `'@/lib/deepseek'`
  - INSTRUCTIONS 长字符串：①「你是『AI 创建』助手，服务对象是小学科学/AI 课教师」；②「先判断用户意图属于 学问/辩论/讨论 哪一类——不确定就先问一两句关键问题再调工具」；③ 三个 tool 分别什么时候调（参考现有三个 instructions 的硬约束合并）；④「调用 `proposeXxxAgent` 工具后，**必填字段必须齐全**——schema 校验失败前端会拒绝渲染卡片」；⑤「如用户改主意可再次调用对应工具，前后多版草稿用户能在卡片里分别保存」
  - tools 对象 3 个 key，分别对应 `CREATE_TOOL_NAME.xuewen` / `.debate` / `.discussion`
  - 每个 tool **不写 execute**（HITL）
  - temperature 0.5
- **MIRROR**: `lib/agents/create-xuewen.ts:1-44`（结构 1:1 复制，只是 tools 对象多 2 个 key）
- **GOTCHA**: instructions 里要明确「subject 只能取『科学』或『人工智能』，grade 只能 1-6 年级」——这是产品约束，三个旧 instructions 都重复过，新 instructions 也要写
- **VALIDATE**: `pnpm exec tsc --noEmit`

### Task 2: MODIFY `lib/agents/index.ts`

- **ACTION**: 删 `CREATE_AGENTS` 三 key 字典，改为单导出 `unifiedCreateAgent`
- **IMPLEMENT**:
  ```ts
  export { PREP_AGENTS } from './prep';
  export { unifiedCreateAgent } from './create-unified';
  ```
- **GOTCHA**: 不要删 `PREP_AGENTS`——备课流程还在用
- **VALIDATE**: `pnpm exec tsc --noEmit`（应该会立刻爆 `app/api/create-agent/route.ts` 引用了已删的 `CREATE_AGENTS`，进 Task 3 修）

### Task 3: MODIFY `app/api/create-agent/route.ts`

- **ACTION**: 删 `kind` body 字段、删 switch、统一调 `unifiedCreateAgent`
- **IMPLEMENT**:
  ```ts
  import { createAgentUIStreamResponse, type UIMessage } from 'ai';
  import { unifiedCreateAgent } from '@/lib/agents';

  export const runtime = 'edge';
  export const maxDuration = 30;

  interface RequestBody { messages: UIMessage[]; }

  export async function POST(req: Request) {
    let body: RequestBody;
    try { body = await req.json(); } catch { return new Response('invalid json', { status: 400 }); }
    if (!process.env.DEEPSEEK_API_KEY) return new Response('DEEPSEEK_API_KEY missing', { status: 500 });
    if (!Array.isArray(body.messages) || body.messages.length === 0)
      return new Response('messages required', { status: 400 });
    return createAgentUIStreamResponse({ agent: unifiedCreateAgent, uiMessages: body.messages });
  }
  ```
- **MIRROR**: `app/api/create-agent/route.ts:1-50`（保 runtime/edge + 校验骨架，删 switch）
- **VALIDATE**: `pnpm exec tsc --noEmit`

### Task 4: DELETE 三个旧 agent 文件

- **ACTION**: 删 `lib/agents/create-xuewen.ts`、`create-debate.ts`、`create-discussion.ts`
- **VALIDATE**: `pnpm exec tsc --noEmit` —— 应该全过（unified 已替代，index 已 rewire）

### Task 5: CREATE `components/AgentInlineFormCard.tsx`

- **ACTION**: 创建内联卡片组件
- **IMPLEMENT**:
  ```tsx
  'use client';
  import { useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { useToast } from './Toast';
  import { XuewenForm } from './AgentForm/Xuewen';
  import { DebateForm } from './AgentForm/Debate';
  import { DiscussionForm } from './AgentForm/Discussion';
  import {
    type CreateKind, CREATE_KIND_LABEL,
    type XuewenAgentConfig, type DebateAgentConfig, type DiscussionAgentConfig,
  } from '@/lib/agent-schemas';

  type AnyConfig = Partial<XuewenAgentConfig> | Partial<DebateAgentConfig> | Partial<DiscussionAgentConfig>;

  interface Props {
    toolCallId: string;
    kind: CreateKind;
    initial: unknown;        // part.input — 已校验过 schema 的对象
  }

  const KIND_DOT_COLOR: Record<CreateKind, string> = {
    xuewen:     'var(--color-primary)',
    debate:     'var(--color-debate)',
    discussion: 'var(--color-discussion)',
  };

  export function AgentInlineFormCard({ toolCallId, kind, initial }: Props) {
    const toast = useToast();
    const router = useRouter();
    const [config, setConfig] = useState<AnyConfig>(initial as AnyConfig);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [discarded, setDiscarded] = useState(false);

    if (discarded) {
      return (
        <div className="rounded-md px-3 py-2 text-[12px]"
             style={{ background: 'var(--color-bg-gray)', color: 'var(--color-text-5)' }}>
          （已舍弃此草稿 · {CREATE_KIND_LABEL[kind]}）
        </div>
      );
    }

    async function handleSave() {
      const f = config as Record<string, unknown>;
      if (!f.name || !f.subject || !f.grade) {
        toast('「名称 / 学科 / 年级」必填');
        return;
      }
      setSaving(true);
      try {
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, config }),
        });
        if (!res.ok) { toast('保存失败：服务暂不可用'); return; }
        setSaved(true);
        toast(`已保存：${String(f.name)}`);
        setTimeout(() => router.push('/'), 700);
      } catch (e) {
        console.error(e);
        toast('保存失败：网络错误');
      } finally { setSaving(false); }
    }

    return (
      <div className="rounded-xl border bg-white" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 border-b px-4 py-3 text-[13px] font-semibold"
             style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: KIND_DOT_COLOR[kind] }} />
          📝 {CREATE_KIND_LABEL[kind]} 草稿
          {saved && <span className="ml-auto text-[11px] font-normal"
                          style={{ color: 'var(--color-text-5)' }}>已保存</span>}
        </div>
        <div className="p-4">
          {kind === 'xuewen' &&
            <XuewenForm
              value={config as Partial<XuewenAgentConfig>}
              onChange={v => !saved && setConfig(v)} />}
          {kind === 'debate' &&
            <DebateForm
              value={config as Partial<DebateAgentConfig>}
              onChange={v => !saved && setConfig(v)} />}
          {kind === 'discussion' &&
            <DiscussionForm
              value={config as Partial<DiscussionAgentConfig>}
              onChange={v => !saved && setConfig(v)} />}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3"
             style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={() => setDiscarded(true)} disabled={saving || saved}
                  className="h-8 rounded-md px-3 text-[12px] disabled:opacity-50"
                  style={{ color: 'var(--color-text-3)' }}>
            取消草稿
          </button>
          <button onClick={handleSave} disabled={saving || saved}
                  className="h-8 rounded-md px-4 text-[12px] font-medium text-white disabled:opacity-60"
                  style={{ background: 'var(--color-primary)' }}>
            {saved ? '已保存' : saving ? '保存中…' : '确认保存'}
          </button>
        </div>
      </div>
    );
  }
  ```
- **MIRROR**: 现有 `AgentCreatePage.tsx:106-131` 的 `handleSave` 逻辑直接搬过来；表单 prop 形状 `value/onChange` 来自 `AgentForm/Xuewen.tsx:6-9`
- **GOTCHA**: 卡片内的 `onChange` 在 `saved` 后被禁用——避免保存后用户继续编辑造成困惑
- **GOTCHA**: 必填校验只检查 `name/subject/grade` 三项——schema 上其它字段允许 partial（用户保存前可以慢慢补）
- **VALIDATE**: `pnpm exec tsc --noEmit`

### Task 6: MODIFY `components/ChatArea.tsx`

- **ACTION**: 把 `extractText` 的"丢非 text part"改成 parts.map + switch
- **IMPLEMENT**:
  - 删 `extractText` helper
  - `messages.map` 内部改成 `m.parts?.map((part, i) => switch (part.type) { ... })`
  - 三个 tool case：`case 'tool-proposeXuewenAgent' | 'tool-proposeDebateAgent' | 'tool-proposeDiscussionAgent'`
    - state === `'input-streaming'` → 渲染一行小字 "正在生成 [kindLabel] 草稿…"
    - state === `'input-available'` → `<AgentInlineFormCard key={part.toolCallId} toolCallId={part.toolCallId} kind={kindFromToolName(part.type)} initial={part.input} />`
    - 其它 state → null（不会发生，因 HITL 永远卡 input-available）
  - case `'text'` → 保留原文气泡（user/assistant 两套样式，搬现有逻辑）
  - 保留 `isStreaming && '…'` 占位（现仅在最后一条 assistant 还没出第一片文字时显示）
- **HELPER**:
  ```ts
  function kindFromToolName(type: string): CreateKind | null {
    if (type === 'tool-proposeXuewenAgent')    return 'xuewen';
    if (type === 'tool-proposeDebateAgent')    return 'debate';
    if (type === 'tool-proposeDiscussionAgent') return 'discussion';
    return null;
  }
  ```
- **MIRROR**: `components/ChatArea.tsx:13-50` 现有的气泡 className/style — 一字不改地搬到 text case
- **GOTCHA**: tool 卡片不应包在用户气泡那种 `max-w-[86%] self-start` 容器里——卡片要更宽，建议直接 `self-start w-full max-w-[640px]`
- **VALIDATE**: `pnpm exec tsc --noEmit`

### Task 7: REWRITE `components/AgentCreatePage.tsx`

- **ACTION**: 改成全屏聊天 + 删除 50/50 layout / formState / lastApplied / findLatestToolCall / Topbar 右侧保存按钮
- **IMPLEMENT**:
  - 删 `kind: CreateKind` prop（现在没参数）
  - 删 import：`XuewenForm` / `DebateForm` / `DiscussionForm` / `useRouter` / `useToast`（卡片自己处理保存）
  - 删 `formState` / `lastApplied` / `saving` 三个 useState
  - 删 `useEffect` 监听 toolCall
  - 删 `handleSave`
  - `useChat` body 改成 `body: {}`（或干脆 `transport: new DefaultChatTransport({ api: '/api/create-agent' })` 不传 body）
  - GREETING 改成单一通用文案：`'你好。我是「AI 创建」助手——告诉我你想做个什么 agent（学问 / 辩论 / 讨论 都行），我帮你拼配置。'`
  - 布局塌成单列：`<main>` 里只一个 `<section>` 装 ChatArea + ChatInput；不要 grid
  - Topbar `crumb="AI 创建"`，`right={null}`，`showRecordsNav={false}`
- **MIRROR**: `components/PrepToolPage.tsx`（备课页，单列结构），如不存在则参考现有 ChatArea + ChatInput 的相对布局
- **VALIDATE**: `pnpm exec tsc --noEmit && pnpm dev` (手动 smoke test 见 Validation Commands)

### Task 8: CREATE `app/create/page.tsx` & DELETE `app/create/[kind]/page.tsx`

- **ACTION**:
  - 新建 `app/create/page.tsx`：
    ```tsx
    import { AgentCreatePage } from '@/components/AgentCreatePage';
    export default function Page() { return <AgentCreatePage />; }
    ```
  - 删 `app/create/[kind]/page.tsx`，删 `app/create/[kind]/` 整个目录
- **VALIDATE**: `pnpm exec tsc --noEmit`

### Task 9: MODIFY `app/page.tsx`

- **ACTION**: 入口收敛
- **IMPLEMENT**:
  - 删 `QUICK_NEW` 数组 + 它的 `.map` 渲染（lines 103-108 + 256-275）
  - 在 QUICK_NEW 原位置放一颗按钮：`<Link href="/create" className="...primary..."><span>＋ AI 创建</span></Link>`，样式参考现有 `+ 新建` 链接（line 232 那种）但更醒目（`bg-[var(--color-primary)] text-white`）
  - 删 `KIND_TO_CREATE` 映射（line 127-131）
  - "+ 新建"链接（line 232）`href` 从 `/create/xuewen` 改 `/create`
  - "AI 对话新建"虚框卡片（line 288）`href` 从 `/create/xuewen` 改 `/create`
  - 已保存 agent 卡片上的"编辑"按钮（如果存在）：暂时隐藏（用 `false &&` 包住或直接删 link 留 placeholder text）。注：留待后续单独 PRP
- **GOTCHA**: 保留首页其它逻辑（fetch /api/agents 列表、删除 handler 占位）
- **VALIDATE**: `pnpm exec tsc --noEmit && pnpm dev` 走完整 smoke test

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
cd /Users/liwentao/Desktop/agent-center-demo
pnpm exec tsc --noEmit
pnpm exec next lint   # 如配置了 lint 脚本；否则跳
```
**EXPECT**: 退出 0，无报错

### Level 2: BUILD
```bash
pnpm build
```
**EXPECT**: 构建成功；无 type 错误

### Level 3: MANUAL_SMOKE_TEST
```bash
pnpm dev
```
打开 http://localhost:3000，依次验证：

1. ✅ 首页 ② 授课区域**只有一颗** "+ AI 创建" 按钮（不再是 3 个分类 pill）
2. ✅ 点 "+ AI 创建" → 跳 `/create`（URL 不再有 `[kind]`）
3. ✅ 页面只有一个对话区，**没有右栏空表单**
4. ✅ 输入「给我个三年级讲磁铁的牛顿」→ AI 回复 + 内联卡片出现，卡片标题「📝 AI 学问 草稿」，name 字段已填「牛顿」，subject「科学」，grade「三年级」
5. ✅ 修改 background → 立即反映在卡片内（不影响其它字段）
6. ✅ 输入「把性格改幽默一些」→ 历史里多出第二张卡片（v2），第一张依然存在且仍可独立保存
7. ✅ 在第一张卡片点「取消草稿」→ 卡片折叠为一行小灰字「（已舍弃此草稿）」
8. ✅ 在第二张卡片点「确认保存」→ toast「已保存：牛顿」→ 700ms 后跳首页 → 首页能看见这个新 agent
9. ✅ 重复流程，分别测「四年级辩论塑料袋是否禁用」（→ AI 应调 proposeDebateAgent → 卡片 → 保存 → 首页）和「三年级讨论班级是否禁带零食」（→ proposeDiscussionAgent → 同上）
10. ✅ Console 无红字；Network 里 `/api/create-agent` 200 + `/api/agents` 200

### Level 4: REGRESSION
- ✅ 备课流程 `/prep/*` 依然能跑（PREP_AGENTS 没动）
- ✅ 我的记录 `/records` 依然能列出 records（KV / in-mem 没动）

---

## Acceptance Criteria

- [ ] Level 1 (tsc) 退出 0
- [ ] Level 2 (build) 成功
- [ ] Level 3 全部 10 步手工 smoke test 通过
- [ ] Level 4 回归：备课、记录两条线无影响
- [ ] 删了 3 个旧 agent 文件 + 删了 `[kind]` 目录 + 首页无 hardcode `/create/xuewen`
- [ ] 卡片样式与现有表单组件视觉一致（边框/字号/间距用同一组 token）
- [ ] AI instructions 在 `unifiedCreateAgent` 里能正确路由 3 类需求（手工跑 9 / 10 验证）

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM 在 unified 上路由错（学问 → 调到 debate tool） | MED | MED | instructions 里写明 3 类的判别要点 + 给 1-2 个 few-shot 示例；temperature 降到 0.3-0.5；手工 smoke test 各跑一遍 |
| 多 tool ToolLoopAgent + Edge runtime 是否有未遇到的边界（type narrowing / stream 兼容） | LOW | MED | SDK docblock 已确认无 execute = 立即终止 loop；createAgentUIStreamResponse 与多 tool agent 类型签名兼容（删 switch 的注释可参考） |
| 卡片本地 state 在 React 重渲染时丢失 | LOW | HIGH | 严格用 `key={toolCallId}`（不是 array index）；卡片本身 unmount 才会丢，HITL 模式下 part 不会被移除 |
| 已保存 agent 的"编辑"链接坏掉 | HIGH | LOW | 任务 9 已要求隐藏；用户期望未确认；后续单独 PRP 做"加载现有 config 进卡片"流 |
| `ChatArea` 的样式重写可能误改用户气泡观感 | MED | LOW | 现有 line 22-50 的 className/style 一字不动地搬到 text case |
| 用户保存前关页面 / 刷新 → 草稿丢 | HIGH | LOW | 不在 MVP 范围；UI 上保存按钮位置突出（卡片底）即可 |

---

## Notes

- `app/api/agents/route.ts` 不做 schema 校验是已知的——本期不修。后期如要加，可在 route 内 `XuewenAgentSchema.parse(body.config)` 之类按 kind 选 schema 验证。
- `lib/agent-schemas.ts` 是单一真理来源，**强烈不建议在本计划范围内改它**——3 个 schema 同时被 LLM tool inputSchema、表单组件、（未来）API 校验三处共享。
- 计划完成后，可考虑在 `unifiedCreateAgent` instructions 里加 1-2 个 few-shot："『给我一个讲磁铁的牛顿』→ proposeXuewenAgent / 『四年级辩论塑料袋』→ proposeDebateAgent / 『讨论班级零食问题』→ proposeDiscussionAgent"——能显著提升路由准确度。
- 后续 v0.3 候选：保存后调 `addToolOutput({ output: { saved: true, agentId } })` 让 AI 在对话里说"已为你保存为牛顿，前往我的智能体查看"——纯 UX 糖，技术成本低。
