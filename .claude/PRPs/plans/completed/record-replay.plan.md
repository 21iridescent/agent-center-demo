# Feature: 评价回看 — 学生与 AI 对话记录的"看回去"做实

## Summary

把 CLAUDE.md "备课 / 授课 / 评价" 三段中第三段 **评价** 真正闭环：教师从"我的记录"列表点开任意一条，能完整回看那场对话的全部上下文（学问的多轮对话、辩论的轮次×方+评委点评+评分）。当前"评价"形同虚设——保存只存元数据，列表点击只 `alert("详情页未实现")`。本次改动同时打通"保存时持久化原文"和"详情页按类型渲染只读视图"两端。

## User Story

As 一位用 AI 智能体上完课的小学科学老师
I want to 在课后从"我的记录"翻回某次学问对话或辩论实录、看到当时的全部发言和评委点评
So that 我能据此评价这堂课/这位学生、整理课例、再设计下一节课

## Problem Statement

`app/records/page.tsx` 列表里的「恢复对话 / 查看报告 / 查看记录」按钮，对所有 dialogue / debate / discussion 类型在 `components/RecordCard.tsx:62-65` 走 `alert(...)` 兜底；而 `XuewenUsePage` / `DebateUsePage` 在保存时（`components/XuewenUsePage.tsx:118-137`、`components/DebateUsePage.tsx:194-214`）**只 POST 元数据**，原始消息 / 轮次 / 评委文字一行都没存。即便建了详情页也无内容可渲染。

测试可观察标准：
- 跑一场学问对话 → 点"结束并保存" → 跳"我的记录" → 点该条「恢复对话」 → 看到完整 user/assistant 气泡列表，含 reasoning 折叠块。
- 跑一场辩论 → 召唤评委 → 保存 → 点该条「查看报告」 → 看到辩题条、双方头像、按"第 N 轮 · 正/反方"渲染的发言列表、评委点评全文 + 大字号评分。

## Solution Statement

1. **Schema 扩展** — 给 `DialogueRecord` / `DebateRecord` 加可选 `transcript` 字段，shape 与各自使用页内存中那份一致（学问 = `UIMessage[]`、辩论 = `DebateTurnEntry[]` + `judgeText` + `score`）。
2. **保存路径透传** — `XuewenUsePage` / `DebateUsePage` 的 endAndSave 把 transcript 加进 POST body；`/api/records` route 已经 `Omit<AppRecord, 'id'|'createdAt'>` 透传，自动支持。
3. **新 SSR 路由** — `app/records/[id]/page.tsx`，Next 16 `params: Promise<...>` 约定（参考 `app/use/xuewen/[id]/page.tsx`），从 KV 取记录、按 `type` 分发到 `DialogueReplayPage` / `DebateReplayPage` / `PrepReplayPage`，未知类型 `notFound()`。
4. **复用现有 UI 原子** — 学问回看直接复用 `ChatArea`（已是纯渲染组件）+ `RoleCard`；辩论回看用现有"辩题条 / Fighter 双卡 / 评委卡 / 历史列表"的 read-only 子集。
5. **RecordCard 跳转修复** — 把 `handlePrimary` 里的 `alert` 换成 `router.push('/records/${id}')`；prep 路径维持 `PREP_KIND_TO_PATH` 不变（不在本次范围内）。

## Metadata

| Field            | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                          |
| Complexity       | MEDIUM                                                               |
| Systems Affected | `lib/types.ts`, `app/records/`, `components/RecordCard`, `XuewenUsePage`, `DebateUsePage`, `lib/fallback-records.ts` |
| Dependencies     | 无新增；仅 ai@6.0.176 / @ai-sdk/react@3.0.178 / next@16.2.6 已有          |
| Estimated Tasks  | 9                                                                    |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  授课结束页（学问/辩论）                                                      ║
║  ┌──────────────┐                                                             ║
║  │ 结束并保存   │ ──► POST /api/records ──► KV record:{id}                    ║
║  └──────────────┘     body: {type,title,summary,turns/score,…}                ║
║                       ❌ 没有 transcript / history / judgeText                ║
║                                                                               ║
║  我的记录列表（/records）                                                     ║
║  ┌─────────────────────────────────────────────────┐                          ║
║  │  [N] 牛顿            最后一问：苹果为什么会落  │                          ║
║  │  AI 学问 · 12 轮提问                  [恢复对话]│ ── click ──┐             ║
║  └─────────────────────────────────────────────────┘            │             ║
║                                                                  ▼             ║
║                          ┌────────────────────────────────────────────┐       ║
║                          │  alert("打开：牛顿（详情页未实现）")       │       ║
║                          └────────────────────────────────────────────┘       ║
║                                                                               ║
║  PAIN_POINT:                                                                  ║
║  - 评价闭环断裂；老师无法回看学生在课上跟 AI 说了什么                          ║
║  - 即便加详情页也没数据可渲染                                                  ║
║  DATA_FLOW: useChat(in-mem messages) → 摘要 → KV (元数据 only) → 列表 → ✗    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  授课结束页（学问）                                                           ║
║  ┌──────────────┐                                                             ║
║  │ 结束并保存   │ ──► POST /api/records (body 多带 transcript:{messages})    ║
║  └──────────────┘                                                             ║
║                                                                               ║
║  授课结束页（辩论）                                                           ║
║  ┌──────────────┐                                                             ║
║  │ 保存到记录   │ ──► POST /api/records (body 多带 transcript:                ║
║  └──────────────┘                          {history,judgeText,score})         ║
║                                                                               ║
║  我的记录列表 → 点击                                                          ║
║  ┌─────────────────────────────────────────────────┐                          ║
║  │  [N] 牛顿                              [恢复对话]│ ── router.push ──┐      ║
║  └─────────────────────────────────────────────────┘                  │      ║
║                                                                        ▼      ║
║  ┌─────────────────────────── /records/{id} ─────────────────────────────┐   ║
║  │  Topbar / 我的记录 / 牛顿                                              │   ║
║  │ ┌─────────┬───────────────────────────────────────────────────────┐  │   ║
║  │ │ RoleCard│  ChatArea 只读模式                                    │  │   ║
║  │ │ (240px) │  ┌──────────────────────┐                             │  │   ║
║  │ │ 牛顿    │  │ AI: 你好！我是牛顿   │                             │  │   ║
║  │ │ 五年级  │  └──────────────────────┘                             │  │   ║
║  │ │ 科学    │           ┌──────────────────┐                        │  │   ║
║  │ │ ...     │           │ 用户: 苹果会落   │                        │  │   ║
║  │ │         │           └──────────────────┘                        │  │   ║
║  │ │         │  ┌── 思考过程 ▼ ─────────┐                            │  │   ║
║  │ │         │  ┌──────────────────────┐                             │  │   ║
║  │ │         │  │ AI: 因为重力 ...     │                             │  │   ║
║  │ │         │  └──────────────────────┘                             │  │   ║
║  │ │         │  (无 ChatInput - 只读)                                │  │   ║
║  │ └─────────┴───────────────────────────────────────────────────────┘  │   ║
║  └────────────────────────────────────────────────────────────────────────┘   ║
║                                                                               ║
║  辩论详情页（同一路由 /records/{id}，按 type 分发）：                          ║
║  ┌─────────────────────── /records/{id} ───────────────────────────────┐     ║
║  │  辩题条 + 进度点灯（全亮，read-only）                                │     ║
║  │  正方 Fighter   VS   反方 Fighter   （speaking=false）               │     ║
║  │  ┌──── AI 评委 · 已点评 ───── score: 7.2 / 10 ────┐                  │     ║
║  │  │ 双方论点小结 / 亮点 / 可改进 / 综合点评 全文     │                  │     ║
║  │  └─────────────────────────────────────────────────┘                  │     ║
║  │  辩论实录（N 段发言）                                                 │     ║
║  │  ┌ 第1轮·正方 ┐ 苹果应禁用，因为 ...                                  │     ║
║  │  ┌ 第1轮·反方 ┐ 不该一刀切 ...                                        │     ║
║  │  ...                                                                   │     ║
║  └────────────────────────────────────────────────────────────────────────┘   ║
║                                                                               ║
║  VALUE_ADD: 老师能回看完整对话/辩论 → 评估学生表现 → 整理课例 → 改下次课     ║
║  DATA_FLOW: useChat(messages) → POST(+transcript) → KV → /records/{id}       ║
║              → SSR getRecord → 复用 ChatArea/Fighter 只读渲染                ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                        | Before                                       | After                                              | User Impact                          |
| ------------------------------- | -------------------------------------------- | -------------------------------------------------- | ------------------------------------ |
| `XuewenUsePage` "结束并保存"    | POST 仅元数据                                | POST 多带 `transcript:{messages}`                  | 保存后真的存住对话原文               |
| `DebateUsePage` "保存到记录"    | POST 仅元数据 + judgeText 截断 600 字塞 meta | POST 多带 `transcript:{history,judgeText,score}`   | 保存后存完整发言 + 评委点评          |
| `RecordCard` 卡面 / 主按钮      | 非 prep 类型 `alert("详情页未实现")`         | `router.push('/records/${id}')`                    | 任意记录可深入查看                   |
| `app/records/[id]` （新）       | 不存在                                       | SSR 渲染只读详情，按 type 分发                     | 评价闭环跑通                         |
| `lib/fallback-records.ts`       | demo 记录无 transcript                       | 给 r1（牛顿）/ r3（塑料禁令辩论）补 demo transcript | demo 卡也可点开看演示，不只是空壳     |

---

## Mandatory Reading

**实施 agent 在动手前必须读：**

| Priority | File                                                            | Lines     | Why Read This                                                                                          |
| -------- | --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| P0       | `components/XuewenUsePage.tsx`                                  | 77-150    | 现状 useChat + endAndSave；transcript 改动点（第 121-137 POST body）                                   |
| P0       | `components/DebateUsePage.tsx`                                  | 60-227    | 辩论状态机 + endAndSave；transcript 改动点（第 197-213 POST body）                                     |
| P0       | `components/ChatArea.tsx`                                       | 全文      | 已是 props-driven 纯渲染；只读复用零成本（不传 onSubmit / 无 ChatInput 即可）                          |
| P0       | `components/RecordCard.tsx`                                     | 49-72     | handlePrimary 当前 alert 兜底点；要改成 router.push                                                    |
| P0       | `lib/types.ts`                                                  | 全文      | 在哪个 record interface 里加 transcript 字段                                                           |
| P0       | `app/use/xuewen/[id]/page.tsx`                                  | 全文      | Next 16 dynamic route 标准范式：`params: Promise<{id:string}>` + `await params` + `notFound()`         |
| P0       | `app/api/records/[id]/route.ts`                                 | 6-15      | 同上模式在 route handler 里的写法（`ctx: { params: Promise<{id:string}> }`）                           |
| P1       | `app/api/records/route.ts`                                      | 17-34     | POST 已经 `Omit<AppRecord, 'id'|'createdAt'>` 透传 — 加 transcript 字段不需要改 API，写好类型即可 |
| P1       | `lib/kv.ts`                                                     | 37-48     | createRecord 把整个 input 落 KV，TTL 30 天 — transcript 跟着进                                          |
| P1       | `components/RoleCard.tsx`                                       | 全文      | 学问回看左栏复用                                                                                       |
| P1       | `lib/asset-catalog.ts`                                          | 28-72,212-225 | getXuewenPersona / getDebateActor / getBackground 用法（回看页拼图同样调用）                       |
| P2       | `components/Topbar.tsx`                                         | 全文      | 详情页顶栏复用（crumb=记录名，无 right slot）                                                          |
| P2       | `lib/fallback-records.ts`                                       | 全文      | demo 记录形状；新增 transcript demo 数据要对齐                                                         |

**External Documentation:** 不需要外部文档。Next 16 / AI SDK v6 关键约定在仓库里已有可复用范式（见上 P0 行）。

---

## Patterns to Mirror

**NEXT_16_DYNAMIC_PAGE_PATTERN（SSR + await params + notFound）:**

```tsx
// SOURCE: app/use/xuewen/[id]/page.tsx:10-19
// COPY THIS EXACT PATTERN（仅替换 getAgent → getRecord、kind 校验 → type 分发）
import { notFound } from 'next/navigation';
import { getAgent } from '@/lib/agent-storage';
import { XuewenUsePage } from '@/components/XuewenUsePage';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent || agent.kind !== 'xuewen') notFound();
  return <XuewenUsePage agent={agent} />;
}
```

**SAVE_RECORD_FETCH_PATTERN（保存 + toast + 跳列表）:**

```tsx
// SOURCE: components/XuewenUsePage.tsx:118-150
// COPY 这段；只在 body JSON 里加 `transcript: { messages }` 字段
const res = await fetch('/api/records', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'dialogue',
    title: name,
    summary,
    agentName: name,
    avatar: name.charAt(0),
    avatarUrl: persona?.avatar,
    turns: userTurns,
    meta: { agentId: agent.id, personaId: cfg.personaId, bgAsset: cfg.bgAsset, subject, grade },
  }),
});
if (!res.ok) {
  toast('保存失败：服务暂不可用');
  return;
}
toast('已保存对话到我的记录');
setTimeout(() => router.push('/records'), 700);
```

**RECORDCARD_NAVIGATION_PATTERN（router.push 替换 alert）:**

```tsx
// SOURCE: components/RecordCard.tsx:57-65 (current)
// CHANGE TO（保留 prep 现有路径，其它走详情）：
function handlePrimary(e: React.MouseEvent) {
  e.stopPropagation();
  if (onPrimary) return onPrimary(r);
  if (r.type === 'prep') {
    router.push(PREP_KIND_TO_PATH[r.kind]);
    return;
  }
  router.push(`/records/${encodeURIComponent(r.id)}`);
}
```

**CHATAREA_READ_ONLY_USAGE（学问回看）:**

```tsx
// SOURCE: components/ChatArea.tsx:90 + XuewenUsePage.tsx:212-213
// ChatArea 已经是 props 驱动的纯渲染组件，只传 messages、不传 isStreaming 就是只读
<ChatArea messages={record.transcript.messages} />
// 注意：ChatArea 内部 ThinkingBubble 仅在 isStreaming=true 时出现，回看页天然干净
```

**DEBATE_HISTORY_RENDER_PATTERN（辩论实录列表）:**

```tsx
// SOURCE: components/DebateUsePage.tsx:485-523
// COPY 这段「辩论实录」block — 渲染 history[] 的代码已经现成
{history.map((h, i) => (
  <div key={i} className="flex gap-2.5 border-b pb-3 last:border-b-0 last:pb-0"
       style={{ borderColor: 'var(--color-border-soft)' }}>
    <div className="flex h-7 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold"
         style={{
           background: h.side === 'pro' ? 'var(--color-primary-bg)' : 'var(--color-debate-bg)',
           color: h.side === 'pro' ? 'var(--color-primary)' : 'var(--color-debate)',
         }}>
      第 {h.round} 轮 · {h.side === 'pro' ? '正方' : '反方'}
    </div>
    <div className="flex-1 whitespace-pre-wrap text-[13px] leading-relaxed"
         style={{ color: 'var(--color-text)' }}>
      {h.text}
    </div>
  </div>
))}
```

**DEBATE_JUDGE_VERDICT_PATTERN（评委卡只读态）:**

```tsx
// SOURCE: components/DebateUsePage.tsx:436-481（phase==='judged' 分支即只读态）
// 回看页直接复用：phase 写死 'judged'，judgeText / score 从 record.transcript 取
```

**KV_RECORD_FETCH_PATTERN（详情页 SSR 取 record）:**

```ts
// SOURCE: app/api/records/[id]/route.ts:6-15
// 详情页 server 端不走 fetch /api/records/[id]，直接 import getRecord
import { getRecord } from '@/lib/kv';
const record = await getRecord(id);
if (!record) notFound();
```

**TYPE_EXTENSION_PATTERN（discriminated record 增字段）:**

```ts
// SOURCE: lib/types.ts:24-40 已有的 DialogueRecord / DebateRecord
// 顺这个 shape 补 transcript（可选字段，不破坏现有 r1~r8 fallback）：
import type { UIMessage } from 'ai';
export interface DialogueTranscript {
  messages: UIMessage[];
}
export interface DebateTranscript {
  history: DebateTurnEntry[];   // round/side/text — 与 DebateUsePage 的本地类型一致
  judgeText: string;            // 已剥 <score> 标签
  score?: number;
}
export interface DebateTurnEntry {
  round: number;
  side: 'pro' | 'con';
  text: string;
}
```

---

## Files to Change

| File                                    | Action | Justification                                                                  |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `lib/types.ts`                          | UPDATE | 加 `DialogueTranscript` / `DebateTurnEntry` / `DebateTranscript`，扩两个 record |
| `components/XuewenUsePage.tsx`          | UPDATE | endAndSave POST body 加 `transcript: { messages }`                             |
| `components/DebateUsePage.tsx`          | UPDATE | endAndSave POST body 加 `transcript: { history, judgeText, score }`；同时把 `DebateTurnEntry` 从本地 interface 改成从 `lib/types` import（避免 shape 漂移） |
| `components/RecordCard.tsx`             | UPDATE | handlePrimary 把 alert 换成 router.push('/records/${id}')                       |
| `app/records/[id]/page.tsx`             | CREATE | SSR 入口；await params + getRecord + 按 type 分发到 replay component            |
| `components/DialogueReplayPage.tsx`     | CREATE | 只读复用 RoleCard + ChatArea；agent 配置从 record.meta.agentId 反查（可降级用 record 字段） |
| `components/DebateReplayPage.tsx`       | CREATE | 只读辩题条 + 双方 Fighter + 评委卡（phase='judged'）+ 历史列表                   |
| `lib/fallback-records.ts`               | UPDATE | 给 r1（牛顿）+ r3（塑料禁令辩论）各补 1 份小型 demo transcript，保证 demo 记录点开有内容 |
| `app/records/page.tsx`                  | (无)    | 不需要改；handlePrimary 在 RecordCard 内                                       |

---

## NOT Building (Scope Limits)

显式排除，避免范围爬升：

- **Discussion 类型回看** — `app/use/discussion` 路由 + DiscussionUsePage 组件本期都还没上线；fallback r4/r8 的"查看记录"按钮跳详情页时显示「该类型暂不支持回看」占位，不再多花一组件。
- **Prep 类型回看** — PrepRecord 已经有 `content?: string`，但当前 RecordCard 跳的是 `PREP_KIND_TO_PATH`（即输入页）。本次不改，避免触发"备课工具改 routing"的二次设计。
- **续聊 / 编辑 / 导出** — "恢复对话"按钮只渲染只读视图，不接 useChat 续上下文（沿用现有交易语义"恢复 = 看回去"）。
- **权限 / 多用户 / 学生侧** — 仍是单老师单浏览器，KV 全局命名空间。
- **transcript 截断 / 压缩** — KV 30 天 TTL 自动回收；UIMessage[] 体量在小学课节场景（≤ 20 轮）远低于 KV value 限制（@vercel/kv 1MB），无需提前优化。
- **「最近一次召唤评委 + 多次保存"语义** — 一场辩论召唤评委后只保存一次，本期不解决"重新召唤"。
- **首屏滚动 / 长 transcript 锚点** — 长度短，不做。
- **fallback 中讨论类记录的 transcript** — 占位即可，不补 demo 数据。

---

## Step-by-Step Tasks

按依赖顺序执行；每个任务原子可独立 type-check。

### Task 1: UPDATE `lib/types.ts` — 扩 transcript 类型

- **ACTION**: 文件末尾追加 `DebateTurnEntry` / `DialogueTranscript` / `DebateTranscript`；给 `DialogueRecord` / `DebateRecord` 加可选字段
- **IMPLEMENT**:
  ```ts
  import type { UIMessage } from 'ai';

  export interface DebateTurnEntry {
    round: number;
    side: 'pro' | 'con';
    text: string;
  }
  export interface DialogueTranscript { messages: UIMessage[]; }
  export interface DebateTranscript {
    history: DebateTurnEntry[];
    judgeText: string;
    score?: number;
  }

  // 修改：
  export interface DialogueRecord extends BaseRecord {
    type: 'dialogue';
    turns?: number;
    transcript?: DialogueTranscript;
  }
  export interface DebateRecord extends BaseRecord {
    type: 'debate';
    pro?: number;
    con?: number;
    score?: number;
    transcript?: DebateTranscript;
  }
  ```
- **MIRROR**: `lib/types.ts:24-40`（现有 record interface 风格 + `?:` 可选字段）
- **GOTCHA**: `UIMessage` 来自 `'ai'` 包不是 `'@ai-sdk/react'`；和 `XuewenUsePage.tsx:5` 的 import 一致
- **GOTCHA**: 字段必须 `?:` 可选，否则现有 fallback-records.ts r1~r8 / 历史 KV 数据全部 type-fail
- **VALIDATE**: `npx tsc --noEmit`

### Task 2: UPDATE `components/DebateUsePage.tsx` — 把本地 DebateTurnEntry 换成 import

- **ACTION**: 删除本地 interface，从 `@/lib/types` import；endAndSave 的 POST body 增 transcript 字段
- **IMPLEMENT**:
  - 删第 20-24 行的本地 `interface DebateTurnEntry { ... }`
  - 头部加 `import type { DebateTurnEntry } from '@/lib/types';`
  - `endAndSave` 中（约 195-213 行）`body: JSON.stringify({...})` 内增加：
    ```ts
    transcript: {
      history,
      judgeText: cleanJudge,
      ...(score !== null ? { score } : {}),
    },
    ```
  - `meta.judgeText` 现存的 `slice(0, 600)` 截断可保留作摘要，不冲突
- **MIRROR**: `components/XuewenUsePage.tsx:121-136`（POST body 的 JSON 结构 / 缩进）
- **GOTCHA**: shape 必须与 `DebateTranscript` 完全对齐；TS 会拦
- **VALIDATE**: `npx tsc --noEmit`

### Task 3: UPDATE `components/XuewenUsePage.tsx` — endAndSave 透传 messages

- **ACTION**: 在 POST body 中增加 `transcript: { messages }`
- **IMPLEMENT**: `endAndSave` 第 121-136 行 `body: JSON.stringify({...})` 内追加：
  ```ts
  transcript: { messages },
  ```
- **GOTCHA**: 不要剥 reasoning parts；ChatArea 自身在 `text.length > 0` 才渲染气泡，reasoning 走 `<details>` 折叠 — 直接整包传透
- **GOTCHA**: `messages` 可能含开场白 sys-greet；保留即可，回看时显示"你好！我是 X"，符合预期
- **VALIDATE**: `npx tsc --noEmit`

### Task 4: UPDATE `lib/fallback-records.ts` — 给 r1 / r3 补 demo transcript

- **ACTION**: r1（牛顿对话） + r3（塑料禁令辩论）各补一份最小 transcript，让 demo 卡点开有内容看
- **IMPLEMENT**: 给 r1 加：
  ```ts
  transcript: {
    messages: [
      { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: '你好！我是牛顿。' }] },
      { id: 'm2', role: 'user',      parts: [{ type: 'text', text: '苹果为什么会从树上落下？' }] },
      { id: 'm3', role: 'assistant', parts: [{ type: 'text', text: '这是因为地球有一种看不见的"拉力"...' }] },
    ] as UIMessage[],
  }
  ```
  给 r3 加：
  ```ts
  transcript: {
    history: [
      { round: 1, side: 'pro', text: '一次性塑料袋应当禁用，因为它在自然中需要数百年才能降解...' },
      { round: 1, side: 'con', text: '完全禁用过于一刀切；我们更应推广可降解材料和回收体系...' },
      { round: 2, side: 'pro', text: '即便有可降解替代品，市场普及率仍然很低...' },
      { round: 2, side: 'con', text: '价格和习惯需要时间...' },
    ],
    judgeText: '【双方论点小结】\n正方强调污染严重性 ...\n\n【综合点评】\n双方都展示了不错的论据。',
    score: 7.2,
  }
  ```
- **MIRROR**: 现有 r1 / r3 字段顺序；transcript 加在 `agentName` 之后
- **GOTCHA**: 文件顶 import `import type { UIMessage } from 'ai';`（如缺）
- **VALIDATE**: `npx tsc --noEmit`

### Task 5: UPDATE `components/RecordCard.tsx` — handlePrimary 走 router.push

- **ACTION**: 替换第 57-65 行的 alert 兜底
- **IMPLEMENT**:
  ```tsx
  function handlePrimary(e: React.MouseEvent) {
    e.stopPropagation();
    if (onPrimary) return onPrimary(r);
    if (r.type === 'prep') {
      router.push(PREP_KIND_TO_PATH[r.kind]);
      return;
    }
    router.push(`/records/${encodeURIComponent(r.id)}`);
  }
  ```
- **GOTCHA**: `useRouter` 已 import；不要新加 import
- **GOTCHA**: 卡面 `onClick={handlePrimary}` 已有，行为一致；测试时点空白区也应跳转
- **VALIDATE**: `npx tsc --noEmit && npm run build`（确保 path 编译过）

### Task 6: CREATE `components/DialogueReplayPage.tsx` — 学问只读视图

- **ACTION**: 新建 client 组件，复用 `ChatArea` + `RoleCard`
- **IMPLEMENT**:
  ```tsx
  'use client';
  import { ChatArea } from './ChatArea';
  import { RoleCard } from './RoleCard';
  import { Topbar } from './Topbar';
  import { getXuewenPersona } from '@/lib/asset-catalog';
  import type { DialogueRecord } from '@/lib/types';

  interface Props { record: DialogueRecord; }

  export function DialogueReplayPage({ record }: Props) {
    const messages = record.transcript?.messages ?? [];
    const meta = record.meta ?? {};
    const persona = getXuewenPersona(meta.personaId);
    const name = record.title;
    const subject = meta.subject ?? '科学';
    const grade = meta.grade ?? '一年级';

    return (
      <>
        <Topbar crumb={`回看 · ${name}`} />
        <main className="mx-auto w-full px-6 py-6 pb-12" style={{ maxWidth: 'var(--container-wide)' }}>
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <RoleCard
              name={name}
              subject={subject}
              grade={grade}
              background={meta.background ?? ''}
              avatarUrl={persona?.avatar ?? record.avatarUrl}
              roleUrl={persona?.role}
            />
            <section className="flex min-h-[70vh] flex-col gap-3">
              <div className="flex items-center justify-between border-b pb-2.5"
                   style={{ borderColor: 'var(--color-paper-rule)' }}>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--color-ink-1)' }}>
                  与 <span style={{ color: 'var(--color-type-dialogue-deep)' }}>{name}</span> 的对话回看
                </div>
                <div className="font-numeric tnum text-[11px]" style={{ color: 'var(--color-ink-mute)' }}>
                  {messages.filter(m => m.role === 'user').length} 轮提问
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {messages.length > 0 ? (
                  <ChatArea messages={messages} />
                ) : (
                  <EmptyTranscript />
                )}
              </div>
            </section>
          </div>
        </main>
      </>
    );
  }

  function EmptyTranscript() {
    return (
      <div className="px-6 py-20 text-center text-[13px]"
           style={{ color: 'var(--color-ink-mute)' }}>
        该记录无对话原文（早期保存未带 transcript）
      </div>
    );
  }
  ```
- **MIRROR**: `components/XuewenUsePage.tsx:152-225` 的双栏布局 / `RoleCard` 调用 / `ChatArea` 调用
- **GOTCHA**: 不传 `isStreaming` 就关掉了 ThinkingBubble；不要渲染 `<ChatInput>`
- **GOTCHA**: `record.meta` 是 `Record<string, string|undefined>`，TS 上 `meta.background` 类型是 string|undefined — 直接用 `?? ''`
- **VALIDATE**: `npx tsc --noEmit`

### Task 7: CREATE `components/DebateReplayPage.tsx` — 辩论只读视图

- **ACTION**: 新建 client 组件，复用现有 Fighter 子组件 / 评委卡 read-only 段 / 历史列表
- **IMPLEMENT**: 把 `DebateUsePage.tsx` 中下列 block 拆出来在新组件内组合：
  - 顶部 Topbar（crumb=record.title）
  - 辩题条（line 261-318，全亮 round dots）
  - Fighter 双卡（line 320-351，speaking 全 false）
  - 评委卡（line 436-481 的 phase='judged' 形态；写死显示）
  - 历史实录（line 484-523）
  - **不要**：开始/下一轮/召唤评委/输入框/保存按钮
  - **不要**：streamFetch / phase 状态机 / useState
- **IMPLEMENT 骨架**:
  ```tsx
  'use client';
  import { Topbar } from './Topbar';
  import { getDebateActor, getTopicThumb, DEBATE_JUDGE_AVATAR } from '@/lib/asset-catalog';
  import type { DebateRecord } from '@/lib/types';

  interface Props { record: DebateRecord; }

  export function DebateReplayPage({ record }: Props) {
    const t = record.transcript;
    const history = t?.history ?? [];
    const judgeText = t?.judgeText ?? '';
    const score = t?.score;
    const meta = record.meta ?? {};
    const proActor = getDebateActor(meta.proActorId);   // 若 endAndSave 没存就 undefined，Fighter 走 ? 占位
    const conActor = getDebateActor(meta.conActorId);
    const thumb = getTopicThumb(meta.thumbAsset);

    return (
      <>
        <Topbar crumb={`回看 · ${record.title}`} />
        <main className="relative mx-auto w-full px-6 py-6 pb-12" style={{ maxWidth: 'var(--container-wide)' }}>
          {/* 辩题条 — 进度点全亮 */}
          {/* Fighter 双卡 — speaking={false} */}
          {/* 评委卡 — 写死 phase='judged'，显示 judgeText + score */}
          {/* 历史实录列表 */}
          {(!t || history.length === 0) && (
            <div className="px-6 py-20 text-center text-[13px]"
                 style={{ color: 'var(--color-ink-mute)' }}>
              该辩论无实录原文（早期保存未带 transcript）
            </div>
          )}
        </main>
      </>
    );
  }
  ```
- **MIRROR**: `components/DebateUsePage.tsx:261-523` 的 layout / className / style；按 source line range 复制 + 拆掉交互
- **GOTCHA**: `Fighter` 子组件在 DebateUsePage.tsx:539-611 内部定义；可以 `export function Fighter(...)` 提到模块顶层、然后两边都 import；或在 Replay 页内重新声明同样的本地 Fighter（对小项目优先选后者，避免改 DebateUsePage 默认行为）
- **GOTCHA**: 评委卡 `judgeText` 渲染时记得 `whitespace-pre-wrap`；现有源码已用
- **VALIDATE**: `npx tsc --noEmit && npm run build`

### Task 8: CREATE `app/records/[id]/page.tsx` — 详情路由 SSR

- **ACTION**: Next 16 dynamic page，按 type 分发
- **IMPLEMENT**:
  ```tsx
  import { notFound } from 'next/navigation';
  import { getRecord } from '@/lib/kv';
  import { Topbar } from '@/components/Topbar';
  import { DialogueReplayPage } from '@/components/DialogueReplayPage';
  import { DebateReplayPage } from '@/components/DebateReplayPage';

  export default async function Page({
    params,
  }: {
    params: Promise<{ id: string }>;
  }) {
    const { id } = await params;
    const record = await getRecord(id);
    if (!record) notFound();

    if (record.type === 'dialogue') return <DialogueReplayPage record={record} />;
    if (record.type === 'debate')   return <DebateReplayPage   record={record} />;

    // discussion / prep — 暂不支持回看，统一占位
    return (
      <>
        <Topbar crumb={`回看 · ${record.title}`} />
        <main className="mx-auto w-full px-10 pt-12"
              style={{ maxWidth: 'var(--container-list)' }}>
          <div className="px-6 py-20 text-center"
               style={{
                 background: 'var(--color-paper-soft)',
                 border: '1px solid var(--color-paper-edge)',
                 borderRadius: 'var(--radius-sm)',
               }}>
            <div className="font-display text-[18px]" style={{ color: 'var(--color-ink-2)' }}>
              该类型记录暂不支持回看
            </div>
            <div className="mt-2 text-[13px]" style={{ color: 'var(--color-ink-3)' }}>
              （Discussion / Prep 详情页未上线）
            </div>
          </div>
        </main>
      </>
    );
  }
  ```
- **MIRROR**: `app/use/xuewen/[id]/page.tsx:10-19`（params Promise + await + notFound）
- **GOTCHA**: `getRecord` 是 server-only（用了 `@vercel/kv`），不要在 'use client' 文件 import
- **GOTCHA**: fallback-records.ts 里的 r1~r8 这些 demo 记录的 id 不在 KV 里 — `getRecord` 会返回 null → 404。要让 demo 卡也能点开，需要在这个 page 里降级查 fallback：
  ```ts
  import { FALLBACK_RECORDS } from '@/lib/fallback-records';
  const record = (await getRecord(id)) ?? FALLBACK_RECORDS.find(r => r.id === id) ?? null;
  ```
- **VALIDATE**: `npx tsc --noEmit && npm run build`

### Task 9: 端到端冒烟（手测）

- **ACTION**: `npm run dev`，按下面流程跑一遍
- **STEPS**:
  1. 进 `/`，从首页或 `/create/xuewen` 配一个学问 agent → 进使用页跑 3-4 轮对话 → 点"结束并保存" → 跳到 `/records`
  2. 在记录列表点该条「恢复对话」 → 应进入 `/records/{id}`，左 RoleCard、右 ChatArea 完整渲染对话
  3. 进辩论 agent 跑完整轮 → 召唤评委 → 保存 → 列表点「查看报告」 → 应看到辩题条 + 双方 Fighter + 评委卡（评分大字号）+ 历史实录
  4. 在 `/records` 点 demo r1（牛顿）/ r3（塑料禁令辩论） → 应看到补的 demo transcript（不是 404）
  5. 在 `/records` 点 demo r4（讨论）→ 应进 `/records/r4` 看到「该类型记录暂不支持回看」占位（不是 404）
  6. 直接 `curl http://localhost:3000/records/i-do-not-exist` → 404 页
- **VALIDATE**: 每条都能复现 → 通过

---

## Testing Strategy

### 没有现成测试框架——以 type-check + build + 手测覆盖

仓库目前无 vitest / jest / playwright（package.json 仅 dev/build/start 三 script）。本期**不**新增测试框架（与 NOT Building 一致）；用以下三层验证替代：

| 层      | 命令                              | 标准                                      |
| ------- | --------------------------------- | ----------------------------------------- |
| Type    | `npx tsc --noEmit`                | 0 错 0 警告                               |
| Build   | `npm run build`                   | next build 通过、所有动态路由生成成功      |
| 手测    | Task 9 的 6 步                    | 全部能复现                                 |

### Edge Cases Checklist（手测时需主动覆盖）

- [ ] 早期记录（无 transcript 字段）点开 → 显示「无对话原文」占位，不 crash
- [ ] 对话只有 1 轮 → ChatArea 渲染正常
- [ ] 辩论存有 transcript 但 `judgeText=''` / `score=undefined` → 评委卡仍渲染但显示「无评委点评」（DebateReplayPage 内部判断）
- [ ] 学问对话含 reasoning parts → `<details>` 折叠正常，不自动展开（reasoningStreaming=false）
- [ ] reasoning 文本含中英文换行 → `whitespace-pre-wrap` + `inherit` font 正常
- [ ] URL `id` 含特殊字符（`/` / `?`）→ encodeURIComponent 已加，跳转 OK
- [ ] 直接刷新 `/records/{id}`（SSR 入口） → 不 hydrate mismatch
- [ ] discussion 类型 fallback 记录 → 占位页

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
cd /Users/liwentao/Desktop/agent-center-demo
npx tsc --noEmit
```

**EXPECT**: 0 错。
**注意**: 项目无 ESLint script；只跑 tsc。next build 自带 lint。

### Level 2: BUILD

```bash
npm run build
```

**EXPECT**: 编译成功；`/records/[id]` 出现在路由清单。

### Level 3: 端到端 dev 手测

参见 Task 9。需要 `.env.local` 配 `OPENROUTER_API_KEY`（已在 .env.local，使用页才能产生真 transcript；只验回看 demo 不需要 key）。

### Level 4 (跳过): 单元测试 — 无框架。

### Level 5 (可选): BROWSER_VALIDATION
若环境装了 chromium，可用 `gstack browse` 跑 Task 9 的步骤 4-6（不依赖真 AI）。

---

## Acceptance Criteria

- [ ] `npx tsc --noEmit` 0 错
- [ ] `npm run build` 通过
- [ ] 学问对话保存后能从 `/records` 点开看到完整对话
- [ ] 辩论保存后能从 `/records` 点开看到完整发言 + 评委点评 + 评分
- [ ] demo 卡 r1 / r3 点开能看到 demo transcript
- [ ] demo 卡 r4（讨论）点开看到占位页而非 404 / crash
- [ ] 不存在的 id 直接 404
- [ ] RecordCard 不再出现 `alert("详情页未实现")`
- [ ] 详情页设计语言与列表页一致（纸感 paper-soft 框 / 章式横条 / OKLCH 暖色）

---

## Completion Checklist

- [ ] Task 1 完成（types 扩展）
- [ ] Task 2 完成（DebateUsePage transcript 透传 + DebateTurnEntry import 统一）
- [ ] Task 3 完成（XuewenUsePage transcript 透传）
- [ ] Task 4 完成（fallback demo transcript）
- [ ] Task 5 完成（RecordCard router.push）
- [ ] Task 6 完成（DialogueReplayPage）
- [ ] Task 7 完成（DebateReplayPage + Fighter 内联）
- [ ] Task 8 完成（/records/[id] SSR + fallback 降级）
- [ ] Task 9 完成（端到端冒烟通过）
- [ ] type-check 通过
- [ ] build 通过

---

## Risks and Mitigations

| Risk                                                                                                           | Likelihood | Impact | Mitigation                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `UIMessage` shape 在 ai@6.x 上随 sendReasoning / tool parts 演化，未来字段不兼容存档                            | LOW        | MED    | TTL 30 天自动汰旧；transcript 是可选字段，未来加 `transcriptVersion?: number` 即可向后兼容                          |
| KV value 过大（极长辩论 + reasoning 全包） 触发 1 MB 上限                                                       | LOW        | MED    | 小学课节天然短；如观察到再补 `messages.parts.filter(p => p.type !== 'reasoning')` 写入                              |
| Fighter 子组件被两个文件复制，未来一处改一处忘改                                                                | LOW        | LOW    | 接受小重复（< 80 行）；待 Discussion 上线时一并提取到 `components/debate/Fighter.tsx`                                |
| Demo 记录降级路径（FALLBACK_RECORDS 兜底）让 SSR 强依赖 fallback-records.ts，bundle 体积上升                    | LOW        | LOW    | 该文件已被 `app/records/page.tsx` import；新页面只是再 import 一次，不重复打包                                      |
| Next 16 `params` Promise 模式新手会写错（直接 `params.id` 不 await）                                            | MED        | HIGH   | Mandatory Reading P0 行已点出 `app/use/xuewen/[id]/page.tsx` 模板；按抄即可                                          |
| 早期/历史 KV 记录（无 transcript）直接 crash                                                                    | MED        | MED    | 全程 `record.transcript ?? undefined` + Replay 组件内 EmptyTranscript 占位（Task 6/7 已写）                          |

---

## Notes

- **关于"评价"语义**：CLAUDE.md 把产品分成 备课 / 授课 / 评价 三段。「评价」目前在 UI 上对应"我的记录"页 + 单条详情。本期完成"看回去"，下一期才轮到"打分 / 转写学习单 / 导出 PDF"。
- **关于 Fighter 提取**：故意不在本期把 `Fighter` 抽成共享组件，因为：(a) DebateUsePage 还在小步迭代（speaking 动画刚加），抽走会增加合并冲突面；(b) DebateReplayPage 用的是 `speaking={false}` 简化态，可以内联一份更小版本。等 discussion 使用页上线 / Discussion replay 也需要类似 Roster 时再抽。
- **关于 DialogueReplayPage 不取 SavedAgent**：使用页（XuewenUsePage）需要 `agent` 才能拼 systemPrompt 续聊；回看页只渲染、不续聊，所以 `record.title + meta + persona` 就够。这避免了 agent 被删除后回看页 404 的问题。
- **关于 demo 记录 id 与 KV 命名空间冲突**：demo 用 `r1~r8 / p1~p4`，真实 KV 用 `r_${ts}_${rand}`，不会撞名。降级查 fallback 是按 id 精确匹配，不会污染真实记录。
- **关于"恢复对话"按钮的文案**：用户说"恢复"但本期实现的是"回看"。文案保持现状（用户已熟悉），只把行为做实；如果产品要求严格区分"恢复 = 续聊"，需另立一期加 useChat 续上下文，不在本期。
