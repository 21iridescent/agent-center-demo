# Feature: 智能体直接编辑表单 + 关联课程

## Summary

修两个相关坑：(1) 当前点 `编辑` 任何智能体，都跳到一个空的 AI 对话创建页 —— 不仅没有"直接编辑表单"，连原 agent 数据都没带过去，保存还会创建一个新副本（**编辑实际上等于复制**）。修复方案是新增 `/edit/[id]` 路由，复用现成的三套表单组件（`Xuewen / Debate / Discussion`），用 agent 的现有值预填，保存走新加的 `PUT /api/agents/[id]`。 (2) 三种类型的智能体在创建和编辑时都新增一个"是否关联课程"字段，选项来自一个小的静态课程清单（demo 阶段先种子）。

## 复用 vs 新增 partition（per `feedback_use_pages_reuse_strategy.md`）

| 层 | 复用 | 新增 |
|---|---|---|
| 路由 | `/create`（保留作为"AI 对话创建"入口）、`/api/agents/[id]` 文件 | `/edit/[id]`（新文件）、`PUT /api/agents/[id]`（同文件加方法） |
| UI 组件 | `XuewenForm` / `DebateForm` / `DiscussionForm`（三个表单组件原封不动复用）、`Field`、`Topbar` | `EditAgentPage` 客户端组件（仅是个壳：`Topbar` + 三选一渲染表单 + 保存按钮） |
| 表单字段 | 现有所有字段 | 三个 form 内统一加 `<Field label="是否关联课程">` + `<select>` |
| 数据模型 | `SavedAgent`、`CreateKind`、KV key shape | `linkedCourseId?: string` 加进三个 schema；新 `agents:hidden-seeds` KV set；新 `lib/courses.ts` 种子清单 |
| 入口（链接来源） | `AgentCard` 组件 | 改 `editHref` 计算逻辑：`/create` → `/edit/${id}` |
| 持久层 | KV `agent:{id}` / `agents:list` | 新 `updateAgent()`、新 `addHiddenSeedAgentId()`、新 `listHiddenSeedAgentIds()`；新 KV key `agents:hidden-seeds` |

## User Story

作为一名在 demo 里管理智能体的老师
我希望点 `编辑` 直接进入预填好的表单，并且在保存（创建或编辑）时能选择"这个智能体属于哪门课程或不关联"
这样我能快速微调已有 agent 的细节，不用重头跟 AI 对话；并且能按课程组织我的 agent 集合。

## Problem Statement

1. **编辑路径完全断裂**：`AgentCard` 上的 `编辑` 链接对所有 agent 都指向同一个 `/create` 静态 URL（`app/page.tsx:74` 是 seed 的赋值，`:211` 是 `savedToSeed` 里 saved agent 的赋值）。`/create` 页面 (`AgentCreatePage`) 启动时 `formState = {}`、`currentKind = null`（`components/AgentCreatePage.tsx:55-79`），完全没有意识到自己在"编辑"哪个 agent。用户走完 AI 对话或手填表单后点保存，`POST /api/agents` 调 `createAgent` 生成新 id（`lib/agent-storage.ts:213-228`），原 agent 在存储里完全没动，列表里多出一条复制。
2. **没有 update 通路**：`lib/agent-storage.ts` 只导出 `listAgents / getAgent / createAgent / deleteAgent` —— 没有 `updateAgent`。`/api/agents/[id]` 只有 `GET + DELETE`，没有 `PUT/PATCH`。换句话说："编辑"在持久层是不可能的，必须新增。
3. **没有课程关联**：三个 schema (`XuewenAgentSchema` / `DebateAgentSchema` / `DiscussionAgentSchema` at `lib/agent-schemas.ts:35-183`) 都没有任何课程字段。codebase 里 `课程` 字符串只出现两次（一次注释、一次硬编码推荐文案），没有 `Course` 类型、没有种子清单、没有任何 UI 选择器。要满足"关联课程"需求，得自己引入这个产品对象（per CLAUDE.md 已规划的 `Lesson (课时)` 数据模型，是合理的真实对象，不是杜撰概念）。

## Solution Statement

- **新增** `/edit/[id]` 路由：服务器端 `getAgent(id)` → 把现有 `kind + config` 当作 `value` 传进对应 form 组件 → 同一个 `保存` 按钮根据 agent 来源决定是 `PUT /api/agents/[id]`（KV 真记录）还是 `POST /api/agents` + 标记 seed 为隐藏（copy-on-write，复用 `records:hidden-fallback` 的模式）。
- **新增** `lib/courses.ts`：5–6 条小学科学 + AI 课程的静态种子（per `project_scope_focus.md`）。结构：`{ id, title, subject, grade }`。后续真课程服务上线时这个文件即可整体替换为 fetch。
- **新增** schema 字段：三个 `*AgentSchema` 都加 `linkedCourseId: z.string().optional()`（per "optional id, undefined = unset" 现有约定，不引入额外 boolean flag）。
- **新增** form UI 行：三个 form 组件里都插入 `<Field label="是否关联课程"><select ...>` —— 第一个选项是 `不关联（默认）`，剩下从 `COURSE_SEEDS` 里 map。控件类型完全照抄现有的 `subject` / `grade` 选择器（`components/AgentForm/Xuewen.tsx:101-111`）。

## Metadata

| Field            | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| Type             | ENHANCEMENT + BUG_FIX（编辑流彻底没在工作 + 新字段）                 |
| Complexity       | MEDIUM                                                               |
| Systems Affected | 路由层 / API 层 / 持久层 / 三套表单组件 / AgentCard 入口              |
| Dependencies     | `@vercel/kv`（已有）、`zod`（已有，v4）、Next.js 16 App Router（已有） |
| Estimated Tasks  | 12                                                                   |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ HOME (/)                                                                       ║
║   ┌────────┐ ┌────────┐ ┌────────┐                                            ║
║   │居里夫人│ │达尔文 │ │视觉系统│      [管理] ← 切换 manageMode                ║
║   └────────┘ └────────┘ └────────┘                                            ║
║   each card has 编辑/删除（manage on）or 启动（manage off）                   ║
║                                                                               ║
║   click 编辑 on ANY card → editHref="/create" 对所有 agent 一样                ║
║                                                                               ║
║                          ↓ navigate                                            ║
║                                                                               ║
║ /create — AgentCreatePage                                                     ║
║   ┌──────────────────┐  ┌──────────────────────────────────────┐             ║
║   │ AI 对话（左）    │  │ ?  等 AI 判断类型（右）               │             ║
║   │ 「你想做什么…」 │  │  formState = {}, currentKind = null  │             ║
║   │  ▢▢▢ user types │  │  保存按钮 disabled                    │             ║
║   └──────────────────┘  └──────────────────────────────────────┘             ║
║                                                                               ║
║   原 agent id / config / kind ❌ 完全没传过来                                 ║
║   user 必须从头跟 AI 描述 agent，或在右侧表单里硬填                            ║
║                                                                               ║
║                          ↓ user types + 应用 + 编辑 + 保存                    ║
║                                                                               ║
║ POST /api/agents → createAgent({ kind, config }) → 新 id 生成                  ║
║                                                                               ║
║   原 agent 完全没改动，列表里多出一条 「居里夫人 (副本)」                     ║
║                                                                               ║
║   PAIN: 编辑 = 复制；用户不知道；KV 里数据膨胀；同名 agent 满天飞              ║
║   PAIN: 三种类型创建/编辑表单都没法标记"这是给哪门课用的"                     ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ HOME (/)                                                                       ║
║   ┌────────┐ ┌────────┐ ┌────────┐                                            ║
║   │居里夫人│ │达尔文 │ │视觉系统│      [管理]                                  ║
║   └────────┘ └────────┘ └────────┘                                            ║
║   editHref 现在是 `/edit/${agent.id}` ← 每张卡指向自己                        ║
║                                                                               ║
║                          ↓ navigate                                            ║
║                                                                               ║
║ /edit/[id]  — EditAgentPage（新页，无左侧 AI 对话）                           ║
║                                                                               ║
║   ┌────────────────────────────────────────────────────────────────┐         ║
║   │ Topbar  /  编辑：居里夫人               [取消]  [保存]          │         ║
║   ├────────────────────────────────────────────────────────────────┤         ║
║   │ ▶ 名称        [居里夫人          ]                              │         ║
║   │ ▶ 学科        [科学 ▾]                                          │         ║
║   │ ▶ 年级        [六年级 ▾]                                        │         ║
║   │ ▶ 背景        [详细文本……（已预填）]                            │         ║
║   │ ▶ 角色        [人物 picker —— 已选中]                           │         ║
║   │ ▶ 背景场景    [背景 picker —— 已选中]                           │         ║
║   │ ▶ 是否关联课程 [小学科学 · 六年级 · 物质与能量 ▾]  ← NEW         │         ║
║   │ ▶ …其他字段（按 kind 分支）                                     │         ║
║   └────────────────────────────────────────────────────────────────┘         ║
║                                                                               ║
║   保存路径：                                                                  ║
║     • KV agent  → PUT /api/agents/[id] → updateAgent(id, kind, config)         ║
║     • SEED agent → POST /api/agents (新副本) +                                  ║
║                    addHiddenSeedAgentId(id)（让 seed 从列表消失）              ║
║                                                                               ║
║ /create  仍然是"AI 对话创建"入口（保留：用 AI 从零生成新 agent）              ║
║   也加了"是否关联课程" 字段（同一个表单组件，自动继承）                        ║
║                                                                               ║
║   VALUE: 编辑就是编辑，不会复制；三种 agent 都能挂在一门课程下                ║
║   VALUE: AI 对话仅用于"我也不知道做什么"的从零创建场景                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| 位置 / 文件                          | Before                                | After                                                       | 用户感受               |
| ----------------------------------- | ------------------------------------- | ---------------------------------------------------------- | ---------------------- |
| `AgentCard` `编辑` 按钮              | 跳 `/create`，丢失 id                  | 跳 `/edit/${id}`，带 id                                    | 编辑能编辑到正确 agent |
| `/edit/[id]` 页（新）                | 不存在                                 | 渲染对应 kind 的表单，所有字段预填，无 AI 对话面板          | 直接看到要改的内容     |
| 三种表单的字段尾部                  | 没有课程行                             | 多一行 `<Field label="是否关联课程">` + `<select>`         | 每次保存都能挂课程     |
| 保存按钮（编辑模式）                 | 隐式 `createAgent` (复制)              | KV agent → `PUT`；seed → `POST` + 隐藏原 seed              | 不再产生副本           |
| `/create` AI 对话页                  | 同上 bug 没修，但创建逻辑本来就是创建    | 保持原样（这是"用 AI 从零造"入口），但表单也含课程字段     | 创建时也能挂课程       |

---

## Mandatory Reading

实施 agent 上手前必读：

| Priority | File                                                                       | Lines    | Why                                                                    |
| -------- | -------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| P0       | `components/AgentForm/Xuewen.tsx`                                          | full     | 表单组件接口（`value`, `onChange`），是新页要复用的核心                |
| P0       | `components/AgentForm/Debate.tsx`                                          | full     | 同上                                                                    |
| P0       | `components/AgentForm/Discussion.tsx`                                      | full     | 同上                                                                    |
| P0       | `components/AgentForm/Field.tsx`                                           | 14-45    | `Field` wrapper —— 新课程行也走它，保持视觉一致                         |
| P0       | `lib/agent-schemas.ts`                                                     | 35-189   | 三个 `*AgentSchema` + `CreateKind` —— 新字段加在这里                   |
| P0       | `lib/agent-storage.ts`                                                     | 1-228    | KV key shape、`SavedAgent`、`SEED_AGENTS`、`createAgent / deleteAgent` —— `updateAgent` 模式参照 |
| P0       | `app/api/agents/route.ts`                                                  | 1-40     | 现有 POST 模式 —— 新增 PUT-on-id 时参照其 try/catch + zod 验证流程     |
| P0       | `app/api/agents/[id]/route.ts`                                             | full     | 现有 GET / DELETE —— 新 PUT 加在这里                                   |
| P1       | `app/page.tsx`                                                             | 26-28, 73-74, 197-213 | `editHref` 当前赋值点 —— 改这里                                       |
| P1       | `components/AgentCard.tsx`                                                 | 34-45, 135-157 | `editHref` 接收方                                                  |
| P1       | `lib/kv.ts`                                                                | full     | `addHiddenFallbackRecordId` / `listHiddenFallbackRecordIds` 的模式 —— `agents:hidden-seeds` 完全镜像 |
| P2       | `app/api/records/[id]/route.ts`                                            | full     | seed → 隐藏 vs 真记录 → 物理删 的 dispatch 模式（昨天刚做的）          |
| P2       | `components/AgentCreatePage.tsx`                                           | 87-129   | `handleApplyDraft` + `handleSave` —— 看 AI 对话流如何写入 form        |

External docs：本次完全不需要外部文档（无新依赖、无新框架特性）。

---

## Patterns to Mirror

### 复用：`Field` + `<select>` 选择器（用于"是否关联课程"）

```tsx
// SOURCE: components/AgentForm/Xuewen.tsx:101-111
// COPY THIS PATTERN FOR THE NEW COURSE FIELD:
<Field label="学科" required>
  <select
    className={INPUT_CX}
    style={INPUT_STYLE}
    value={value.subject ?? ''}
    onChange={e => set('subject', e.target.value as XuewenAgentConfig['subject'])}
  >
    <option value="" disabled>选择…</option>
    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
  </select>
</Field>
```

新增的课程行长这样（三个 form 各加一份；`set` 函数本身已经在 form 里：见 Xuewen.tsx 内 `set('voiceStyle', ...)` 的同款）：

```tsx
<Field label="是否关联课程" hint="可选 · 让此智能体出现在某门课程的工具中">
  <select
    className={INPUT_CX}
    style={INPUT_STYLE}
    value={value.linkedCourseId ?? ''}
    onChange={e => set('linkedCourseId', e.target.value || undefined)}
  >
    <option value="">不关联（默认）</option>
    {COURSE_SEEDS.map(c => (
      <option key={c.id} value={c.id}>
        {c.subject} · {c.grade} · {c.title}
      </option>
    ))}
  </select>
</Field>
```

`onChange` 里 `e.target.value || undefined` —— 空字符串折回 `undefined`，符合 schema "optional id" 约定。

### 复用：optional 字段在 schema 的写法

```ts
// SOURCE: lib/agent-schemas.ts:44-46
// COPY THIS PATTERN:
voiceStyle: z.string().optional().describe('音色描述，如「沉稳男声·适合历史人物」'),
```

新增字段：

```ts
linkedCourseId: z.string().optional().describe('已关联的课程 id（来自 lib/courses.ts）；undefined 表示未关联'),
```

### 复用：`createAgent` —— `updateAgent` 必须保持同样的接口形态

```ts
// SOURCE: lib/agent-storage.ts:213-228
// MIRROR (但是 update 路径)：
export async function createAgent(input: { kind: CreateKind; config: Record<string, unknown> }): Promise<SavedAgent> {
  const id = `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const agent: SavedAgent = { id, kind: input.kind, config: input.config, createdAt: now, updatedAt: now };
  if (!HAS_KV) {
    _mem.store.set(id, agent);
    _mem.list.unshift(id);
    return agent;
  }
  await kv.set(`agent:${id}`, agent, { ex: AGENT_TTL_SEC });
  await kv.lpush(AGENTS_LIST_KEY, id);
  return agent;
}
```

### 复用：seed-vs-real dispatch 模式（昨天的 records 工作）

```ts
// SOURCE: app/api/records/[id]/route.ts:26-39
// COPY THIS PATTERN FOR seed-vs-real agent edit save dispatch（only on **client-side** decision in EditAgentPage）:
const FALLBACK_IDS = new Set(FALLBACK_RECORDS.map(r => r.id));
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (FALLBACK_IDS.has(id)) {
    await addHiddenFallbackRecordId(id);
  } else {
    await deleteRecord(id);
  }
  return new NextResponse(null, { status: 204 });
}
```

agent 这边的对应：`SEED_AGENT_IDS = new Set(Object.keys(SEED_AGENTS))`（lib/agent-storage.ts:64-211 的 keys）。

### 复用：hidden set in KV (key + helpers)

```ts
// SOURCE: lib/kv.ts (yesterday's records work)
// COPY THIS PATTERN，但是用 'agents:hidden-seeds' key 和 _mem.hiddenAgentSeeds Set:
export async function addHiddenFallbackRecordId(id: string): Promise<void> {
  if (!HAS_KV) { _mem.hiddenFallback.add(id); return; }
  await kv.sadd(HIDDEN_FALLBACK_KEY, id);
}
export async function listHiddenFallbackRecordIds(): Promise<string[]> {
  if (!HAS_KV) return [..._mem.hiddenFallback];
  const ids = await kv.smembers(HIDDEN_FALLBACK_KEY);
  return ids ?? [];
}
```

新加的同款两个函数命名：`addHiddenSeedAgentId(id)` / `listHiddenSeedAgentIds()`，KV key `agents:hidden-seeds`。

### 复用：动态路由参数（Next 16 是 Promise）

```ts
// SOURCE: app/api/records/[id]/route.ts:9
// Next 16 dynamic params are Promise — must await:
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  ...
}
```

`/edit/[id]/page.tsx` 也是同款。

---

## Files to Change

| File                                              | Action  | Justification                                                   |
| ------------------------------------------------- | ------- | --------------------------------------------------------------- |
| `lib/courses.ts`                                  | CREATE  | 课程种子清单 (5–6 条) + `Course` 类型 + `COURSE_SEEDS` 导出      |
| `lib/agent-schemas.ts`                            | UPDATE  | 三个 schema 各加 `linkedCourseId: z.string().optional()`         |
| `lib/agent-storage.ts`                            | UPDATE  | 新加 `updateAgent()` + 新加 `addHiddenSeedAgentId / listHiddenSeedAgentIds` + `_mem.hiddenSeedAgents` + key `AGENTS_HIDDEN_SEEDS_KEY` |
| `app/api/agents/[id]/route.ts`                    | UPDATE  | 新增 `PUT` 方法 —— 接 `{ kind, config }`，调 `updateAgent`       |
| `app/api/agents/route.ts`                         | UPDATE  | `GET` 同时返回 `hiddenSeedIds`，让首页能过滤 seed                |
| `components/AgentForm/Xuewen.tsx`                 | UPDATE  | 末尾加"是否关联课程"行                                           |
| `components/AgentForm/Debate.tsx`                 | UPDATE  | 同上                                                            |
| `components/AgentForm/Discussion.tsx`             | UPDATE  | 同上                                                            |
| `app/edit/[id]/page.tsx`                          | CREATE  | 服务器组件 —— `getAgent(id)` → 渲染 `<EditAgentPage>` 客户端组件 |
| `components/EditAgentPage.tsx`                    | CREATE  | 客户端组件 —— Topbar + 三选一渲染对应 form + `保存`/`取消` 按钮 |
| `app/page.tsx`                                    | UPDATE  | seed 的 `editHref: /create` → `editHref: /edit/${id}`；`savedToSeed.editHref` 同改；fetch records-style hiddenSeedIds 过滤掉被隐藏的 seed |
| `components/AgentCreatePage.tsx`                  | (NO CHANGE) | 表单组件本身已加新字段，AI 对话创建流自动继承                  |

---

## NOT Building (Scope Limits)

明确不在本次 plan 范围：

- **类型命名规范化**（codebase: 学问/辩论/讨论 vs memory: 学问/思辨/速创）—— 是另一个独立 refactor，会动 `KIND_TO_TYPE`、`AgentCard` 标签、route 名、所有 UI 文案，跟这次的 edit-flow + course-link 正交。
- **真课程数据服务**：`lib/courses.ts` 是 demo 静态种子，不接真的 lesson 接口。当平台 lesson 服务上线时再换实现，picker UI 不动。
- **seed 智能体的"撤销隐藏"**：删了/编辑过的 seed 隐藏后，目前没有恢复 UI。和 records 那边一样，是 demo 范围外。
- **课程视角的反向查询**（"在课程 A 下显示所有关联 agent"）：这次只做 agent → course 的 1:1 引用，不做 course → agents 的列表。
- **批量编辑 / 批量关联课程**：单条 agent 编辑只覆盖单条。
- **agent diff / 编辑历史**：不做版本记录、不做 undo，每次 PUT 都是覆盖式。
- **AI 对话编辑流**：`/create` 那条 AI 对话路径用于*创建*；不做"用 AI 改已有 agent"的对话变体（用户的诉求就是"不要 AI 对话来编辑"）。

---

## Step-by-Step Tasks

按依赖顺序，每条都能独立验证。

### Task 1 — CREATE `lib/courses.ts`

- **ACTION**: 新建文件，导出 `Course` 类型 + `COURSE_SEEDS` 数组 + `getCourseById(id)` 工具函数。
- **IMPLEMENT**:
  ```ts
  export interface Course {
    id: string;
    title: string;            // e.g. '物质与能量'
    subject: '科学' | '人工智能';
    grade: '一年级' | '二年级' | '三年级' | '四年级' | '五年级' | '六年级';
  }
  export const COURSE_SEEDS: Course[] = [
    { id: 'course-science-3-life',      title: '生命世界',     subject: '科学',     grade: '三年级' },
    { id: 'course-science-4-matter',    title: '物质与能量',   subject: '科学',     grade: '四年级' },
    { id: 'course-science-5-earth',     title: '地球与宇宙',   subject: '科学',     grade: '五年级' },
    { id: 'course-science-6-tech',      title: '工程与技术',   subject: '科学',     grade: '六年级' },
    { id: 'course-ai-5-foundation',     title: 'AI 启蒙',      subject: '人工智能', grade: '五年级' },
    { id: 'course-ai-6-application',    title: 'AI 应用入门',  subject: '人工智能', grade: '六年级' },
  ];
  export function getCourseById(id: string | undefined): Course | undefined {
    if (!id) return undefined;
    return COURSE_SEEDS.find(c => c.id === id);
  }
  ```
- **MIRROR**: 风格对齐 `lib/types.ts`（顶层 interface + const 数组）。
- **VALIDATE**: `npx tsc --noEmit`

### Task 2 — UPDATE `lib/agent-schemas.ts`

- **ACTION**: 在三个 schema 里都加 `linkedCourseId: z.string().optional()`。
- **PLACE**: 紧跟在已有 optional 字段（如 `coldStart`）后面。
- **MIRROR**: `voiceStyle: z.string().optional().describe(...)` 模式（`lib/agent-schemas.ts:44-46`）。
- **GOTCHA**: 三处都要改（XuewenAgentSchema / DebateAgentSchema / DiscussionAgentSchema）。schema 改完 inferred type (`XuewenAgentConfig` 等) 自动得到 `linkedCourseId?: string`，form 组件就能直接 `value.linkedCourseId`。
- **VALIDATE**: `npx tsc --noEmit`

### Task 3 — UPDATE `lib/agent-storage.ts` —— 新增 `updateAgent`

- **ACTION**: 在 `createAgent` 之后加 `updateAgent`。
- **IMPLEMENT**:
  ```ts
  export async function updateAgent(
    id: string,
    input: { kind: CreateKind; config: Record<string, unknown> },
  ): Promise<SavedAgent | null> {
    const existing = await getAgent(id);
    if (!existing) return null;
    if (SEED_AGENTS[id]) return null;  // seeds are not writable; caller must copy-on-write
    const next: SavedAgent = {
      ...existing,
      kind: input.kind,
      config: input.config,
      updatedAt: new Date().toISOString(),
    };
    if (!HAS_KV) {
      _mem.store.set(id, next);
      return next;
    }
    await kv.set(`agent:${id}`, next, { ex: AGENT_TTL_SEC });
    return next;
  }
  ```
- **MIRROR**: `createAgent` (`lib/agent-storage.ts:213-228`) 的 KV-vs-mem 双路径。
- **GOTCHA**: 不要把 seed agent 当 KV agent 去 `kv.set` —— 即便 seed 路径走得通，未来真正的 seed 修改是个 codebase 改动，不是运行时改动。所以函数级别就拒绝。
- **VALIDATE**: `npx tsc --noEmit`

### Task 4 — UPDATE `lib/agent-storage.ts` —— 加 hidden-seed 集合

- **ACTION**: 加 `AGENTS_HIDDEN_SEEDS_KEY = 'agents:hidden-seeds'`、`_mem.hiddenSeedAgents: Set<string>`、`addHiddenSeedAgentId(id)` 和 `listHiddenSeedAgentIds()`。
- **MIRROR**: 完全照搬 `lib/kv.ts` 里 `addHiddenFallbackRecordId` / `listHiddenFallbackRecordIds` 的实现 —— 只是 key 和 mem-bucket 名字换。
- **VALIDATE**: `npx tsc --noEmit`

### Task 5 — UPDATE `app/api/agents/[id]/route.ts` —— 加 PUT

- **ACTION**: 加 `PUT` 方法，体型 `{ kind, config }`。如果 id 命中 SEED_AGENTS → 返 409（`{ error: 'seed_not_writable' }`，由前端去做 copy-on-write）。否则 `updateAgent`，返 `{ agent }`。如果 `updateAgent` 返 null → 404。
- **MIRROR**: 现有 POST (`app/api/agents/route.ts:19-40`) 的 zod 验证 + try/catch 模式。
- **IMPLEMENT** (草图):
  ```ts
  export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    let body: { kind?: string; config?: Record<string, unknown> };
    try { body = await req.json(); } catch { return 400; }
    if (!body.kind || !body.config) return 400;
    if (!VALID_KINDS.includes(body.kind as CreateKind)) return 400;
    if (SEED_AGENT_IDS.has(id)) return 409 with body { error: 'seed_not_writable' };
    try {
      const agent = await updateAgent(id, { kind: body.kind as CreateKind, config: body.config });
      if (!agent) return 404;
      return NextResponse.json({ agent });
    } catch { return 503; }
  }
  ```
- **VALIDATE**: 启动 `npm run dev`，本地 curl PUT 测一条。

### Task 6 — UPDATE `app/api/agents/route.ts` —— GET 返回 hiddenSeedIds

- **ACTION**: GET 改成 `Promise.all([listAgents(50), listHiddenSeedAgentIds()])`，response shape `{ agents, hiddenSeedIds }`。
- **MIRROR**: `app/api/records/route.ts` GET 现在的 `{ records, hiddenFallbackIds }` 模式（昨天刚改）。
- **GOTCHA**: 前端 (`app/page.tsx`) 同步调整 fetch handler 读 `hiddenSeedIds`（见 Task 12）。
- **VALIDATE**: `curl /api/agents` 看 JSON shape。

### Task 7 — UPDATE `components/AgentForm/Xuewen.tsx`

- **ACTION**: 在合适位置（学科/年级 块附近，或末尾"可选"区前）插入"是否关联课程"行。
- **PLACE**: 字段顺序建议：放在 `年级` 之后、`音色（可选）` 之前。
- **IMPLEMENT**: 用上文 *Patterns to Mirror* 中给出的 `<Field label="是否关联课程">` snippet。
- **IMPORTS**: `import { COURSE_SEEDS } from '@/lib/courses';`
- **GOTCHA**: `set('linkedCourseId', e.target.value || undefined)` —— 别保存空字符串，否则 schema validate 不过（`z.string().optional()` 允许 undefined 但 `''` 是 string）。
- **VALIDATE**: 表单页面看到新字段，下拉显示 6 个课程 + 默认"不关联"。

### Task 8 — UPDATE `components/AgentForm/Debate.tsx`

- **ACTION + IMPLEMENT**: 同 Task 7，插入相同 snippet。
- **PLACE**: 放在 `年级` 之后。
- **VALIDATE**: 表单页面看到新字段。

### Task 9 — UPDATE `components/AgentForm/Discussion.tsx`

- **ACTION + IMPLEMENT**: 同 Task 7，插入相同 snippet。
- **PLACE**: 放在 `年级` 之后。
- **VALIDATE**: 表单页面看到新字段。

### Task 10 — CREATE `app/edit/[id]/page.tsx`（server component）

- **ACTION**: 服务器组件 —— 通过 `getAgent(id)` 拿到 agent；如果 null → `notFound()`；否则把 `agent` 整体作为 prop 传给 `<EditAgentPage>` 客户端组件。
- **IMPLEMENT** (草图):
  ```tsx
  import { notFound } from 'next/navigation';
  import { getAgent } from '@/lib/agent-storage';
  import { EditAgentPage } from '@/components/EditAgentPage';

  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const agent = await getAgent(id);
    if (!agent) notFound();
    const isSeed = id.startsWith('seed-');  // or use SEED_AGENT_IDS check
    return <EditAgentPage agent={agent} isSeed={isSeed} />;
  }
  ```
- **MIRROR**: `app/records/[id]/page.tsx` 的 `getRecord(id)` + 类型分发模式（昨天的 PrepReplayPage 工作）。
- **VALIDATE**: 浏览器访问 `/edit/seed-curie` 应看到居里夫人预填的表单。

### Task 11 — CREATE `components/EditAgentPage.tsx`（client component）

- **ACTION**: `'use client'` 客户端组件。`useState(agent.config)` 作为 formState；按 `agent.kind` 渲染对应表单组件；Topbar 含面包屑 `编辑 · {agent.config.name}` + 两按钮（取消、保存）。
- **保存逻辑**:
  - 必填字段校验（同 `AgentCreatePage.handleSave` 逻辑：`name` 等必填项不能空）。
  - 如果 `isSeed` → `POST /api/agents` 创建副本 → 然后 `addHiddenSeedAgentId` 通过新增的小 endpoint（或者直接复用 GET 已经带回来的 hiddenSeedIds，但这里我们要主动加，所以新加 `POST /api/agents/hidden-seeds` 或直接在 PUT failure 时 fallback —— 二选一）。
  - 否则 → `PUT /api/agents/${id}`。
  - 成功 → toast 「已保存」+ router.push('/').
  - 失败 → toast 「保存失败」.
- **CANCEL**: `router.push('/')`。
- **MIRROR**: `AgentCreatePage` 的 `setFormState` + 三向分支 (`Xuewen / Debate / Discussion`) 渲染 (`components/AgentCreatePage.tsx:278-301`)。
- **GOTCHA**: 不要复用 `AgentCreatePage` 整个 —— 本次需求就是要 *没有* 左侧 AI 对话面板。新组件只渲染右侧表单。
- **GOTCHA**: copy-on-write 的 hidden-seed 标记：要么再开一个 `POST /api/agents/[id]/hide-seed` 端点（最干净，建议），要么在 GET response 上让前端本地标记（脏，不推荐）。**推荐**：新加一个 `POST /api/agents/[id]/hide-seed` 端点，body 空，路由只调 `addHiddenSeedAgentId(id)`。
- **VALIDATE**: 浏览器测：(a) 编辑 KV agent → 列表里 name 变；(b) 编辑 seed agent → 多出新条目，原 seed 消失。

### Task 12 — UPDATE `app/page.tsx`

- **ACTION 1**: 改 `editHref` 计算 —— `INITIAL_AGENTS` 的硬编码 `editHref: '/create'` 改成 `editHref: \`/edit/${seed.id}\``；`savedToSeed` 里同改。
- **ACTION 2**: fetch 处理 hiddenSeedIds —— 当前的 fetch (`app/page.tsx:` 拉 saved agents 那一段) 的 `.then` 里加 `setHiddenSeedIds(d.hiddenSeedIds ?? [])`，过滤 `INITIAL_AGENTS` 时 `.filter(s => !hiddenSeedIds.has(s.id))`.
- **MIRROR**: `app/records/page.tsx:23-44` 的 `hiddenFallback` set 处理（昨天刚做）。
- **VALIDATE**: 编辑 seed → 保存 → 刷新首页应看到原 seed 消失，新副本在列表。

### Task 13（小，不在 12 里因为是隐藏端点）— CREATE `app/api/agents/[id]/hide-seed/route.ts`

- **ACTION**: 新文件 —— `POST` 方法，调 `addHiddenSeedAgentId(id)`，返 204。
- **MIRROR**: `app/api/records/[id]/route.ts:26-39` 的 hidden-fallback dispatch（实际只是它的"add"分支独立成端点）。
- **GUARD**: 如果 id 不在 SEED_AGENT_IDS → 400 (`{ error: 'not_a_seed' }`)。
- **VALIDATE**: `curl -X POST /api/agents/seed-curie/hide-seed` → 204。

---

## Testing Strategy

### 手测 checklist (demo 项目无单测基础设施)

1. **直接编辑流（KV agent）**:
   - 在首页 AI 对话创建一个新 agent → 在管理模式点编辑 → 验证：URL 是 `/edit/{id}`、表单已预填、改一个字段保存、首页该 agent 名字变了、agent id 没变（KV 里 `agent:{id}` 同一条 record，只是 `updatedAt` 新）。
2. **直接编辑流（seed agent）**:
   - 管理模式点编辑居里夫人 → 表单已预填 seed 的内容 → 改 name 保存 → 首页：原居里夫人消失，新条目顶部出现、id 形如 `a_xxx`。
3. **课程关联字段**:
   - 创建/编辑三种 kind 都看到"是否关联课程"行，下拉 6 条课程 + "不关联"。
   - 选一条课程保存 → 下次编辑该 agent，下拉默认就在那条课程上。
   - 选"不关联（默认）"保存 → KV record 的 `config.linkedCourseId` 应该是 undefined（不是空字符串）。
4. **AI 对话创建流仍然工作**:
   - 走 `/create` 的 AI 对话 → 应用 → 表单里也有"是否关联课程"行。
   - 选一门课，保存 → 新建 agent 的 `linkedCourseId` 持久化到 KV。
5. **回归（之前已 fix 的功能不应受影响）**:
   - 删除记录仍然 KV 持久化（昨天的 records 工作）。
   - DebateUsePage 可正常打开。
   - 备课记录回看仍能看到正文。

### Edge Cases Checklist

- [ ] `/edit/{不存在的id}` → 404
- [ ] `/edit/{seed-id}` 直接编辑 seed → 编辑保存后原 seed 隐藏
- [ ] 编辑后取消 → 列表无变化
- [ ] 选了课程后改成"不关联" → schema validate 通过、KV record 无 `linkedCourseId` 字段
- [ ] 新课程清单的 6 个 id 都不重复
- [ ] hiddenSeedIds 在 KV 持久化（关掉 dev server 重启验证）
- [ ] 三种 kind 都加了 `linkedCourseId`，schema parse 不报错

---

## Validation Commands

agent-center-demo 的 `package.json` 当前 scripts（如有未列项请补）：

### Level 1: STATIC ANALYSIS

```bash
cd /Users/liwentao/Desktop/agent-center-demo && npx tsc --noEmit
```

**EXPECT**: exit 0

### Level 2: BUILD

```bash
cd /Users/liwentao/Desktop/agent-center-demo && npm run build
```

**EXPECT**: build 成功，无 type 错误。

### Level 3: DEV BROWSER VALIDATION

```bash
cd /Users/liwentao/Desktop/agent-center-demo && npm run dev
```

然后浏览器手测上面 5 条 + edge cases。

### Level 4: PROD VERIFY (after deploy)

```bash
# Replace seed-id and prod URL appropriately
curl -s https://agent-center-demo-21iridescents-projects.vercel.app/api/agents | jq '.hiddenSeedIds'
curl -X PUT https://.../api/agents/{some-real-id} -H 'Content-Type: application/json' -d '{"kind":"xuewen","config":{...}}'
```

---

## Acceptance Criteria

- [ ] 任何 agent 卡的 `编辑` 都跳到 `/edit/{该 agent 的真实 id}`，URL 不再是 `/create`。
- [ ] `/edit/[id]` 页面无 AI 对话面板，只有表单。
- [ ] 表单所有字段（name / subject / grade / 各 kind 特有字段）都按当前 agent 的值预填。
- [ ] 保存 KV agent → 同 id 的 record 在 KV 被覆盖（不复制）；`updatedAt` 改了；列表 name 同步。
- [ ] 保存 seed agent → 新建副本（新 id），原 seed 从首页消失。
- [ ] 三个 kind 的表单都看得到"是否关联课程"行；下拉首项是"不关联（默认）"。
- [ ] 选课程并保存后，下次进入编辑表单 → 课程下拉的当前值就是上次选的那条。
- [ ] AI 对话创建 (`/create`) 流仍工作；保存出来的 agent 里 `linkedCourseId` 跟随表单选择。
- [ ] `npx tsc --noEmit` 通过；`npm run build` 通过。
- [ ] 之前的 KV records 删除 / 备课回看 / 辩论使用页 都未受影响。

---

## Risks and Mitigations

| Risk                                             | Likelihood | Impact | Mitigation                                                    |
| ------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------- |
| seed copy-on-write 后用户期望"撤销隐藏"          | MED        | LOW    | 文档里说明：删 seed 同款逻辑；未来 demo 加恢复 UI 即可        |
| 三个 form 重复粘贴课程行 → 后续维护漂移          | MED        | LOW    | 接受重复（per CLAUDE.md "三行重复优于过早抽象"）；后续多 kind 时再抽 `LinkCourseField`。 |
| 用户保存了 `linkedCourseId` 后课程被从 seeds 删除 | LOW        | LOW    | `getCourseById` 返 undefined；UI 渲染时回退显示"未关联"；下次保存自动清掉这个字段 |
| `/create` 现有 AI 对话在加了新字段后渲染问题      | LOW        | MED    | 新字段是 optional，AI 不主动设置时空 → 表单走默认 "不关联"     |
| Vercel KV 配额 (新 key set + PUT 调用)           | LOW        | LOW    | 新加一个 set + 复用现有 key shape，配额影响可忽略             |

---

## Notes

### 设计取舍记录

- **为什么 `linkedCourseId?: string` 而不是 `{ linked: boolean, courseId?: string }`？**
  codebase 全场没有 boolean+optional-id 的搭配；`personaId` / `bgAsset` / `thumbAsset` 全是 "undefined = unset"。多加一个 boolean flag 既冗余又有"两个真值不一致"的风险（`linked: true, courseId: undefined`）。单字段更稳。UI 文案 "是否关联课程" 由 label 承担，跟用户原话一致。

- **为什么不抽 `<LinkCourseField>` 共享组件？**
  目前只有三处用，一行 `<Field><select>...</select></Field>` 没复杂到值得新文件。若将来加第 4 / 5 种 kind 再抽。

- **为什么 seed agent 走 copy-on-write 而不是禁止编辑？**
  demo 启动时没有 user-saved agent，全是 seed。如果 seed 不能编辑，"管理 → 编辑" 按钮等于 demo 里都是死的。Copy-on-write 是最小可用解。

- **为什么不在编辑页支持改 kind？**
  改 kind 等于换数据 schema (xuewen → debate 字段完全不一样)，等于建新 agent。让用户走 "删除 + 新建" 路径，不在本次 plan。

### 与昨天的 records 工作的相互参考

- `addHiddenFallbackRecordId` ↔ `addHiddenSeedAgentId`（完全镜像）
- `app/api/records/[id]/route.ts` 的 seed-vs-real dispatch ↔ `EditAgentPage` 的 save 分支
- `PrepReplayPage` 服务器组件 + 客户端子组件分层 ↔ `app/edit/[id]/page.tsx` + `EditAgentPage`

如果实施 agent 没看过昨天 (2026-05-07) 的 commits `94c2694` 和 `e606611`，强烈建议先 `git show` 看一眼 —— 同款套路。
