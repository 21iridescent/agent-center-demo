# Feature: 全部智能体页（/agents）+ 学科 / 年级筛选 + 上次使用 / 创建时间排序

## Summary

把首页"授课"段右上角的死按钮 `查看全部 →`（当前 `toast('暂未开放')`）替换成一个真实的 `/agents` 页面：以首页同款 4 列卡片网格列出**全部智能体**（KV 中保存的 + 硬编码 seed），上方挂一条**纸卡式筛选条**，提供 4 个维度——

- 学科（filter）：全部 / 科学 / 人工智能
- 年级（filter）：全部 / 一-六年级
- 排序（sort）：上次使用 / 创建时间
- 类型隐含支持但不在本期暴露 UI（明确出 scope）

筛选状态走 URL searchParams（`/agents?subject=科学&grade=五年级&sort=createdAt`）—— 这样可分享、可后退、可刷新，匹配 Next 16 文档推荐的 `useSearchParams + window.history.replaceState` 客户端筛选模式。

## User Story

As a 一线小学科学/人工智能老师
I want to 在一个独立页面里看到全部智能体并按学科 / 年级筛选、按上次使用 / 创建时间排序
So that 当首页 4 列网格只展示常用 8–14 张时，我能在备课需要"翻档案册"时找到那张『四年级科学塑料袋辩论』

## Problem Statement

首页 ② 段授课卡区右上角已经放了一个 `查看全部 →` 按钮，但点击只 toast `暂未开放`（`app/page.tsx:428–434`）。当智能体随时间累计到 20+，老师要手动滚首页找一张辩论卡 / 一张五年级讨论卡的 cost 会陡增。同时项目里的 `subject`、`grade` 已经是严格 Zod 枚举（`lib/agent-schemas.ts:21–29`），但**没有任何筛选 UI 暴露给用户**——这种"语义有 / 入口无"的状态最违反编辑式信息层级原则。

## Solution Statement

新建 `app/agents/page.tsx`（client component，套 `Suspense` 匹配 `/records` 页面模式），复用首页已有的 `AgentCard` 视觉契约和 4 列宽幅容器（`min(1480px, calc(100vw - 80px))`）。新增 `components/AgentFilters.tsx` —— **不**复用 `FilterChips`，因为后者把 `FilterValue` 硬钉死成 `RecordType`（`'all' | 'dialogue' | 'debate' | 'discussion' | 'prep'`），且只支持单行单维度。`AgentFilters` 是同样的纸卡视觉语言（border 1px paper-edge / radius-sm / paper-card 底）但变成多行带左侧 label 的 chip 组（"学科 / 年级 / 排序"）。

数据层：把当前藏在 `app/page.tsx` 内部的 `INITIAL_AGENTS`、`KIND_TO_TYPE`、`savedToSeed`、`AgentSeed` 类型抽到 `lib/agents-display.ts`，并扩两条字段 `createdAt: string`、`lastUsedAt: string`（ISO）。**不动 `SavedAgent` 存储 schema** —— "上次使用"用 `SavedAgent.updatedAt` 做代理（已存在），edit 也会刷它，是合理近似且零迁移风险；INITIAL_AGENTS 里的 8 张演示卡硬编码合理 ISO 值（与现有 `'昨天' / '上周' / '3 天前'` 字符串对齐）。

排序用 ISO 字符串字典序（ISO 8601 字典序==时间序，安全）。筛选 / 排序状态读自 `useSearchParams()`，写入用 `window.history.replaceState()`（不污染 history stack，每次切换 chip 不要 push 一格回退）—— Next 16 文档明确推荐的客户端 sort/filter 模式。

## Metadata

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Type             | NEW_CAPABILITY（新页面）+ ENHANCEMENT（首页死按钮活化、Topbar 入口） |
| Complexity       | MEDIUM                                                             |
| Systems Affected | `app/page.tsx`, `components/Topbar.tsx`, 新增 `app/agents/`、`components/AgentFilters.tsx`、`lib/agents-display.ts` |
| Dependencies     | next 16.2.6, react 19.2.4（均已安装；无新依赖）                    |
| Estimated Tasks  | 8                                                                  |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE                                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   首页 ② 授课                                                                  ║
║   ┌────────────────────────────────────────────────────────────────────┐     ║
║   │ ⊟ AGT  授课 · 班级里的 AI 角色                  [查看全部 →] 管理 NEW│     ║
║   │                                                       ╳            │     ║
║   ├────────────────────────────────────────────────────────────────────┤     ║
║   │ [card] [card] [card] [card]                                        │     ║
║   │ [card] [card] [card] [card]   ← 一直 4×N 全部铺出                    │     ║
║   └────────────────────────────────────────────────────────────────────┘     ║
║                                                                               ║
║   USER_FLOW: 想找一张『五年级科学』辩论卡 → 滚首页 → 视觉扫描                  ║
║   PAIN_POINT:                                                                 ║
║     • [查看全部 →] 是死按钮，点了 toast「暂未开放」                              ║
║     • 卡数累积到 20+ 时，眼扫成本陡增                                          ║
║     • subject / grade / kind 都是 Zod 强枚举，但没有筛选 UI 暴露               ║
║   DATA_FLOW: GET /api/agents → savedToSeed() → [...savedAgents, ...seedAgents]║
║              → 4 列 grid 全量渲染                                              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              AFTER                                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   顶栏（Topbar）                                                              ║
║   ┌─[AC] 智能体中心   全部智能体  我的产出  我的记录              李老师─────┐ ║
║   └──────────────────  ▲ 新增链接                                            ┘ ║
║                                                                               ║
║   首页 ② 授课                                                                  ║
║   [查看全部 →] 改成 <Link href="/agents">，点击直接跳                          ║
║                                                                               ║
║   ───────────  /agents 页（min(1480px, vw-80) 宽）  ───────────               ║
║   ┌────────────────────────────────────────────────────────────────────┐     ║
║   │ ⊟ ALL  全部智能体 · 按学科 / 年级 / 时间检索归档                       │     ║
║   ├────────────────────────────────────────────────────────────────────┤     ║
║   │ ┌──────────────────────────────────────────────────────────────┐  │     ║
║   │ │ 排序  [上次使用]  [创建时间]                       共 14 个   │  │     ║
║   │ │ ────                                                          │  │     ║
║   │ │ 学科  [全部]  [科学]  [人工智能]                              │  │     ║
║   │ │ ────                                                          │  │     ║
║   │ │ 年级  [全部] [一] [二] [三] [四] [五] [六]                    │  │     ║
║   │ └──────────────────────────────────────────────────────────────┘  │     ║
║   │                                                                    │     ║
║   │ [card] [card] [card] [card]                                        │     ║
║   │ [card] [card] [card] [card]                                        │     ║
║   │ [card] [card] [card] [card]                                        │     ║
║   │ [card] [card]                                                      │     ║
║   └────────────────────────────────────────────────────────────────────┘     ║
║                                                                               ║
║   USER_FLOW: 顶栏点"全部智能体"或首页点"查看全部 →"                            ║
║              → 落 /agents → 默认按 lastUsedAt desc                            ║
║              → 点"科学" + "五年级"chip → URL 变 ?subject=科学&grade=五年级    ║
║              → 网格收敛到匹配卡 → 点"启动"进入 /use/{kind}/{id}                ║
║   VALUE_ADD: 单页扫描即筛即排；URL 可分享 / 可刷新                             ║
║   DATA_FLOW: GET /api/agents → [...savedAgents, ...seedAgents]                ║
║              → 内存 filter(subject,grade) → sort(by lastUsedAt|createdAt desc)║
║              → 4 列 grid                                                       ║
║              筛选：useSearchParams 读 → window.history.replaceState 写         ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                      | Before                            | After                                               | User Impact                                  |
| ----------------------------- | --------------------------------- | --------------------------------------------------- | -------------------------------------------- |
| `app/page.tsx:428–434`        | `<button onClick={toast(...)}>`   | `<Link href="/agents">查看全部 →</Link>`            | 死按钮活化，跳转到全集页                     |
| `components/Topbar.tsx:58–73` | 仅"我的产出 / 我的记录"          | 新增"全部智能体"在最左                              | 任何页面都能 1 跳到全集页                    |
| `/agents`                     | 路由不存在（404）                 | 新页面：4 列网格 + 筛选条 + URL state               | 按学科/年级/时间检索 14+ 卡                  |
| URL                           | `/agents` 无 query                | `/agents?subject=科学&grade=五年级&sort=createdAt`   | 状态可分享 / 可刷新 / 可后退                  |

---

## Mandatory Reading

**实现 agent 必须先读这些文件，再开始任何 task：**

| Priority | File                                                       | Lines       | Why Read This                                                                                                                            |
| -------- | ---------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | `app/page.tsx`                                             | 85–249      | `INITIAL_AGENTS` + `KIND_TO_TYPE` + `savedToSeed` 是要抽走的源；要原样搬，不丢字段                                                     |
| P0       | `app/page.tsx`                                             | 380–500     | 容器宽度 `min(1480px, calc(100vw - 80px))`、4 列 grid、section header 章式 stamp 都从这里照抄                                          |
| P0       | `app/records/page.tsx`                                     | 1–80, 110–185 | Suspense + useSearchParams + 远端拉取 + 空态 / loading 提示的标准范式；/agents 页结构上是它的 4 列网格变体                              |
| P0       | `components/FilterChips.tsx`                               | 全部        | 视觉语言（active stamp / inactive border）必须照抄到 `AgentFilters`；不要复用此文件本身（值域绑死了 RecordType）                       |
| P0       | `components/AgentCard.tsx`                                 | 全部        | 直接复用；它的 props (`type, avatar, avatarUrl?, bgUrl?, name, subject, grade, lastUsed, launchHref, editHref, manageMode, onDelete`) 不动 |
| P0       | `components/Topbar.tsx`                                    | 56–76       | 新增"全部智能体" Link 的位置、样式（`text-[17px]` + `var(--color-ink-3)` + `hover:underline underline-offset-[8px] decoration-1`）       |
| P1       | `lib/agent-storage.ts`                                     | 15–21, 70–217 | `SavedAgent` 形状 + `SEED_AGENTS` ISO timestamps（INITIAL_AGENTS 里 seed-* 的 createdAt 应与此对齐）                                     |
| P1       | `lib/agent-schemas.ts`                                     | 21–29, 201   | `SUBJECT` / `GRADE` / `CreateKind` 强枚举；`AgentFilters` 的 chip 值集合就是它们                                                          |
| P1       | `app/api/agents/route.ts`                                  | 9–22        | GET 不接任何 query —— 客户端拿全集再内存筛即可，不要在这里加参数                                                                       |
| P2       | `app/globals.css`                                          | 27–104, 161–163, 312–323 | font / OKLCH 纸调 / brand 三色 / `--container-list` / `.stamp` 工具类                                                            |
| P2       | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` | 全部 | Next 16 的 useSearchParams 行为 + 必要的 Suspense 边界                                                                            |
| P2       | `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` | "window.history.pushState" 段（约 250 行往后） | 客户端筛选/排序的官方推荐范式（`window.history.pushState/replaceState` + useSearchParams）                              |

**External Documentation:**

无外部文档需求 —— 所有 API 形态在 `node_modules/next/dist/docs/` 已自带，且 `/records` 页已有完整可仿写的同代码库范例。Tailwind 4 / React 19 的相关 hooks 已在项目里大量使用。

---

## Patterns to Mirror

**SUSPENSE_+_USESEARCHPARAMS（页面外壳）:**

```tsx
// SOURCE: app/records/page.tsx:1–35
// COPY THIS PATTERN（含中文注释也照搬，跟项目风格一致）：
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
// ...

export default function RecordsPage() {
  // useSearchParams 需要 Suspense 边界（Next.js 静态生成阶段可能没 search params 上下文）
  return (
    <Suspense fallback={null}>
      <RecordsPageInner />
    </Suspense>
  );
}

function RecordsPageInner() {
  const sp = useSearchParams();
  const initialFilter = (() => {
    const f = sp.get('filter');
    return f && (VALID_FILTERS as string[]).includes(f) ? (f as FilterValue) : 'all';
  })();
  // ...
}
```

**SECTION_HEADER（章式 stamp + display 字标题）:**

```tsx
// SOURCE: app/records/page.tsx:115–148
// COPY THIS PATTERN（仅替换 stamp 文本和 h1 / p 文案）：
<header
  className="mb-6 flex items-end gap-5 border-t pt-5"
  style={{ borderColor: 'var(--color-paper-rule)' }}
>
  <span
    className="stamp h-10 w-10 shrink-0 text-[14px]"
    style={{ borderRadius: 'var(--radius-xs)' }}
    aria-hidden
  >
    REC
  </span>
  <div className="flex flex-1 items-baseline gap-4 min-w-0">
    <h1
      className="font-display text-[28px] font-medium leading-none tracking-[0.5px]"
      style={{ color: 'var(--color-ink-1)' }}
    >
      所有记录
    </h1>
    <p
      className="text-[14px] leading-snug truncate"
      style={{ color: 'var(--color-ink-3)' }}
    >
      回看学生与 AI 的全部对话与产出
    </p>
  </div>
</header>
```

**FILTER_CHIPS（active 章式 + inactive 描边）— 必须照抄 active/inactive 两套 style 对象:**

```tsx
// SOURCE: components/FilterChips.tsx:40–66
// COPY THIS PATTERN — 我们的 AgentFilters 每行 chip 都用这套样式：
<button
  key={f.value}
  onClick={() => onChange(f.value)}
  className="px-3.5 py-1.5 text-[13px] font-medium transition-colors"
  style={
    active
      ? {
          background: 'var(--color-paper-stamp)',
          color: 'var(--color-paper-base)',
          borderRadius: 'var(--radius-xs)',
          letterSpacing: '0.2px',
        }
      : {
          background: 'transparent',
          color: f.tone ?? 'var(--color-ink-2)',
          border: '1px solid var(--color-paper-edge)',
          borderRadius: 'var(--radius-xs)',
        }
  }
>
  {f.label}
</button>
```

**FILTER_CONTAINER（纸卡 + label prefix + result hint）:**

```tsx
// SOURCE: components/FilterChips.tsx:24–76
// COPY THIS PATTERN — 我们要扩到多行：
<div
  className="mb-6 flex flex-wrap items-center gap-2 border px-5 py-3"
  style={{
    background: 'var(--color-paper-card)',
    borderColor: 'var(--color-paper-edge)',
    borderRadius: 'var(--radius-sm)',
  }}
>
  <span
    className="font-numeric mr-3 text-[11px] uppercase tracking-[0.14em]"
    style={{ color: 'var(--color-ink-mute)' }}
  >
    类型
  </span>
  {/* ... chips ... */}
  {resultHint && (
    <span
      className="font-numeric tnum ml-auto text-[12px]"
      style={{ color: 'var(--color-ink-mute)' }}
    >
      {resultHint}
    </span>
  )}
</div>
```

**AGENT_GRID（4 列宽幅）:**

```tsx
// SOURCE: app/page.tsx:470–479
// COPY THIS PATTERN（去掉 + 新建卡，因为这页是只读检索）：
<div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
  {agents.map(a => (
    <AgentCard
      key={a.id}
      {...a}
      editHref={`/edit/${a.id}`}
      manageMode={false}
      onDelete={() => {}}
    />
  ))}
</div>
```

**HOMEPAGE_CONTAINER_WIDTH（必须用 inline style，不是 CSS var）:**

```tsx
// SOURCE: app/page.tsx:389
// COPY THIS PATTERN — /agents 页要和首页同款宽幅，不能用 --container-list（920px 太窄）：
<main
  className="mx-auto w-full px-10 pt-10 pb-24"
  style={{ maxWidth: 'min(1480px, calc(100vw - 80px))' }}
>
```

**REMOTE_FETCH_+_FALLBACK（远端 + seed 兜底）:**

```tsx
// SOURCE: app/page.tsx:293–305
// COPY THIS PATTERN：
useEffect(() => {
  fetch('/api/agents')
    .then(r => r.json())
    .then(d => {
      if (Array.isArray(d.agents)) {
        setSavedAgents(d.agents.map(savedToSeed));
      }
      if (Array.isArray(d.hiddenSeedIds)) {
        setHiddenSeedIds(new Set(d.hiddenSeedIds));
      }
    })
    .catch(() => {});
}, []);
```

**EMPTY_STATE（空筛选结果）:**

```tsx
// SOURCE: app/records/page.tsx:152–183
// COPY THIS PATTERN（仅替换文案）：
<div
  className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center"
  style={{
    background: 'var(--color-paper-soft)',
    border: '1px solid var(--color-paper-edge)',
    borderRadius: 'var(--radius-sm)',
  }}
>
  <span
    className="stamp h-10 w-10 text-[12px]"
    style={{ borderRadius: 'var(--radius-xs)' }}
    aria-hidden
  >
    ø
  </span>
  <div
    className="font-display text-[18px] font-medium"
    style={{ color: 'var(--color-ink-1)' }}
  >
    当前筛选下没有智能体
  </div>
  <div className="text-[13px]" style={{ color: 'var(--color-ink-3)' }}>
    换个学科 / 年级试试，或者去 AI 创建做一个
  </div>
</div>
```

**TOPBAR_NAV_LINK:**

```tsx
// SOURCE: components/Topbar.tsx:60–66
// COPY THIS PATTERN — 我们要在最左加一条同款 Link：
<Link
  href="/agents"
  className="text-[17px] transition-colors hover:underline underline-offset-[8px] decoration-1"
  style={{ color: 'var(--color-ink-3)' }}
>
  全部智能体
</Link>
```

**URL_STATE_WRITE（Next 16 推荐：history.replaceState 不污染 stack）:**

```tsx
// SOURCE: node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md
// （"window.history.pushState" 段 - replaceState 同款 API）
// COPY THIS PATTERN — 切 chip 不要 push 一格回退：
const sp = useSearchParams();

function setParam(key: string, value: string) {
  const params = new URLSearchParams(sp.toString());
  // 默认值（'all' / 'lastUsed'）从 URL 删掉，让链接保持干净
  if (value === 'all' || (key === 'sort' && value === 'lastUsed')) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : '/agents');
}
```

---

## Files to Change

| File                                  | Action  | Justification                                                                                                          |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `lib/agents-display.ts`               | CREATE  | 抽出 `INITIAL_AGENTS` / `KIND_TO_TYPE` / `savedToSeed` / `AgentSeed`，扩 `createdAt` + `lastUsedAt`，让首页和 /agents 共用 |
| `app/agents/page.tsx`                 | CREATE  | 全部智能体页（client component，Suspense + URL state）                                                                  |
| `components/AgentFilters.tsx`         | CREATE  | 多行带 label 的 chip 筛选条；视觉照搬 FilterChips，但 props 形状是 subject / grade / sort 三维                          |
| `app/page.tsx`                        | UPDATE  | 1) `import` 新模块；删本地 `INITIAL_AGENTS` / `KIND_TO_TYPE` / `savedToSeed` / `AgentSeed`；<br>2) 第 428–434 行的 `<button>` 改成 `<Link href="/agents">` |
| `components/Topbar.tsx`               | UPDATE  | 在 nav 第 58 行 `<nav>` 内最左侧插入"全部智能体" Link                                                                  |

**Total: 3 NEW + 2 UPDATE = 5 files**

---

## NOT Building (Scope Limits)

明确不在本期实现，避免 scope creep：

- **类型筛选 chip（学问 / 辩论 / 讨论）** —— 用户原话只点了"学科、年级、上次使用、创建时间"四项；类型筛选是后续可加项，`AgentFilters` 组件 props 留好可扩位但不渲染。
- **多选筛选** —— 学科 / 年级都是单选（点"科学"会替换掉之前的"人工智能"）。多选会让 chip 状态语义复杂化，且老师常见使用是单维度收敛。
- **服务端筛选** —— `GET /api/agents` 不加 query params 支持。客户端拿全集（`limit=50`，覆盖当前规模）做内存筛即可，避免 KV 多次往返。
- **真正的 `lastUsedAt` 字段写入** —— 本期用 `SavedAgent.updatedAt` 做"上次使用"代理（edit 也会刷它）。要做真"会话维度"的 last-used，需要 `POST /api/agents/[id]/touch` + 在 `/use/xuewen/[id]` 和 `/use/debate/[id]` mount 时打点 —— 留作后续 phase。
- **响应式断点** —— 当前首页 4 列 grid 也没有断点（`gridTemplateColumns: 'repeat(4, 1fr)'`），/agents 页保持一致。后续可统一加断点。
- **管理模式（编辑 / 删除）** —— /agents 是只读检索页；管理操作仍走首页 ② 段的"管理"按钮。`AgentCard.manageMode` 在 /agents 始终为 `false`。
- **分页 / 虚拟列表** —— 当前数据量（KV `limit=50` + 8 张 seed）不需要。后续超过 100 卡再上。
- **"+ AI 对话新建"占位卡** —— /agents 是检索页不是建卡页；空筛选态走专门 EmptyState；用户要建卡仍回首页或 /create。
- **kind === 'project'** —— 这是 `PrepKind` 不是 `CreateKind`（`lib/agent-schemas.ts:201` vs `lib/types.ts:3`），不属于智能体范畴，不进 /agents 页。

---

## Step-by-Step Tasks

依序执行。每个 task 是原子的、独立可校验的。

### Task 1: CREATE `lib/agents-display.ts`

- **ACTION**: 新建共享数据/类型模块
- **IMPLEMENT**:
  - `export type AgentSeed`：当前 `app/page.tsx:23–37` 的形状 + 加两个 ISO 字段
    ```ts
    export interface AgentSeed {
      id: string;
      type: AgentType;            // 来自 components/AgentCard
      avatar: string;
      avatarUrl?: string;
      bgUrl?: string;
      name: string;
      subject: string;            // 内容只会落在 SUBJECT 枚举值上
      grade: string;              // 内容只会落在 GRADE 枚举值上
      lastUsed: string;           // 人类可读："昨天" / "上周"
      lastUsedAt: string;         // ISO 8601，供排序
      createdAt: string;          // ISO 8601，供排序
      launchHref: string;
    }
    ```
  - `export const KIND_TO_TYPE`：原样搬自 `app/page.tsx:178–182`
  - `export const INITIAL_AGENTS: AgentSeed[]`：原样搬自 `app/page.tsx:85–169`，**每条加 `createdAt` 和 `lastUsedAt` 两个 ISO**：
    - 与 `lib/agent-storage.ts` SEED_AGENTS 重叠的 id（`seed-curie`, `seed-darwin`, `seed-machine-vision`, `seed-ai-judgement`, `seed-plastic-ban`, `seed-ai-homework`）：`createdAt` 用 SEED_AGENTS 里的同 id 值（如 `seed-curie` → `'2026-04-15T00:00:00.000Z'`，`seed-plastic-ban` → `'2026-04-22T00:00:00.000Z'`，其余按 SEED_AGENTS 实际值）
    - 仅前端展示（`a1`、`a4`）：`createdAt` 用 `'2026-03-01T00:00:00.000Z'` 等更早的合理值
    - `lastUsedAt` 反映现 `lastUsed` 字符串语义（基于 currentDate `2026-05-09`）：
      - `'刚刚'` → `'2026-05-09T08:00:00.000Z'`
      - `'昨天'` → `'2026-05-08T10:00:00.000Z'`
      - `'2 天前'` → `'2026-05-07T...'`
      - `'3 天前'` → `'2026-05-06T...'`
      - `'4 天前'` → `'2026-05-05T...'`
      - `'上周'` → `'2026-05-02T...'`
      - `'2 周前'` → `'2026-04-25T...'`
  - `export function savedToSeed(a: SavedAgent): AgentSeed`：搬自 `app/page.tsx:214–249`，但 return 时新增 `createdAt: a.createdAt` 和 `lastUsedAt: a.updatedAt`（用 updatedAt 做代理）
- **MIRROR**: `app/page.tsx:23–37`（AgentSeed 形状）、`app/page.tsx:85–169`（INITIAL_AGENTS 现 8 条）、`app/page.tsx:214–249`（savedToSeed 整个函数）、`lib/agent-storage.ts:70–217`（SEED_AGENTS 的 ISO 值）
- **IMPORTS**:
  - `import type { AgentType } from '@/components/AgentCard'`
  - `import type { SavedAgent } from '@/lib/agent-storage'`
  - `import { getXuewenPersonaResolved } from '@/lib/persona-assets'`（搬 INITIAL_AGENTS 时 `seed-curie` / `seed-darwin` 等用到，**先 grep 确认实际文件路径**）
  - `import { getTopicThumb } from '@/lib/topic-assets'`（同上）
  - `const PLASTIC_THUMB`：搬自 `app/page.tsx` 顶部 import（grep 实际路径）
- **GOTCHA**:
  - **不要**把 KV 后端逻辑搬过来 —— 这是纯展示层模块，只 `import type { SavedAgent }`
  - INITIAL_AGENTS 里的 `'a1'` / `'a4'` 这俩 discuss 类目前 launchHref 指 legacy HTML（`/legacy/AI思辨使用-讨论-v0.1.html`），保持原样
  - `savedToSeed` 里 `lastUsed: '刚刚'`（人类字符串）保持不变 —— 真渲染靠它，排序靠新加的 `lastUsedAt`
- **VALIDATE**: `npx tsc --noEmit` 无报错

### Task 2: UPDATE `app/page.tsx` — 替换本地定义为模块导入

- **ACTION**: 删本地 `AgentSeed` / `INITIAL_AGENTS` / `KIND_TO_TYPE` / `savedToSeed` 定义，改用 `lib/agents-display` 导入
- **IMPLEMENT**:
  - 顶部 `import` 加 `import { INITIAL_AGENTS, KIND_TO_TYPE, savedToSeed, type AgentSeed } from '@/lib/agents-display';`
  - 删第 23–37 行的 `interface AgentSeed`
  - 删第 85–169 行的 `const INITIAL_AGENTS: AgentSeed[] = [...]`
  - 删第 178–182 行的 `const KIND_TO_TYPE`
  - 删第 214–249 行的 `function savedToSeed(...)`
  - **保留**：`TYPE_DOT_COLOR`（页面内还在用）、`TYPE_TO_LAUNCH`、`KIND_TO_CREATE`、`QUICK_NEW`、`SAVED_LAUNCH`、persona/topic asset 顶部 imports —— 这些首页其它逻辑还在用，不要碰
  - **关键**：savedToSeed 的 `getXuewenPersonaResolved` / `getTopicThumb` 也搬到了新模块，所以本文件这两个 import 现在只剩 `TYPE_DOT_COLOR` 等仍在引用的就保留，不再被引用的就删
- **MIRROR**: 无（这是删除操作）
- **GOTCHA**:
  - savedToSeed 内部用了 `getXuewenPersonaResolved` 和 `getTopicThumb` —— 保证这俩 import 在 `lib/agents-display.ts` 里也存在
  - 不要顺手 reformat 整个文件（diff noise）
- **VALIDATE**:
  - `npx tsc --noEmit` 无报错
  - `npm run dev` 起服务，访问首页 `/`，section ② 卡片视觉与重构前一致（4 列、同样的卡序、avatar/bg 都正常）

### Task 3: UPDATE `app/page.tsx` — 把"查看全部 →" 死按钮改 Link

- **ACTION**: 仅替换第 428–434 行那一个 `<button>`
- **IMPLEMENT**: 把
  ```tsx
  <button
    onClick={() => toast('暂未开放')}
    className="text-[13px] transition-colors hover:underline"
    style={{ color: 'var(--color-ink-3)' }}
  >
    查看全部 →
  </button>
  ```
  改成
  ```tsx
  <Link
    href="/agents"
    className="text-[13px] transition-colors hover:underline"
    style={{ color: 'var(--color-ink-3)' }}
  >
    查看全部 →
  </Link>
  ```
- **MIRROR**: `app/page.tsx:509–515` —— 第 ③ 段的 `查看全部 →` 已经是 `<Link href="/records">` 同款，照抄
- **GOTCHA**: 顶部 `import Link from 'next/link';` 文件里已有，无需重复 import
- **VALIDATE**: `npm run dev` → 访问 `/`，把光标停在 ② 段右上角"查看全部 →"，看 hover state（应该是 underline）；点击跳到 `/agents`（Task 5 完成前会 404，预期）

### Task 4: CREATE `components/AgentFilters.tsx`

- **ACTION**: 新建多行带 label 的筛选条组件
- **IMPLEMENT**:
  - Props：
    ```ts
    interface Props {
      subject: string;     // 'all' | '科学' | '人工智能'
      grade: string;       // 'all' | '一年级' | ... | '六年级'
      sort: string;        // 'lastUsed' | 'createdAt'
      resultHint?: string; // 例 '共 14 个'
      onSubjectChange: (v: string) => void;
      onGradeChange: (v: string) => void;
      onSortChange: (v: string) => void;
    }
    ```
  - 选项常量（顶部）：
    ```ts
    const SUBJECTS = [
      { value: 'all',    label: '全部' },
      { value: '科学',   label: '科学' },
      { value: '人工智能', label: '人工智能' },
    ];
    const GRADES = [
      { value: 'all',    label: '全部' },
      { value: '一年级', label: '一' },
      { value: '二年级', label: '二' },
      { value: '三年级', label: '三' },
      { value: '四年级', label: '四' },
      { value: '五年级', label: '五' },
      { value: '六年级', label: '六' },
    ];
    const SORTS = [
      { value: 'lastUsed',  label: '上次使用' },
      { value: 'createdAt', label: '创建时间' },
    ];
    ```
  - 容器：`paper-card` 浮纸（border / paper-edge / radius-sm / paper-card 底）
  - 三行结构（用 `<div className="flex items-center flex-wrap gap-2 py-2">`）：第一行排序 + result hint（`ml-auto`）、第二行学科、第三行年级；行间用浅色 `border-t paper-rule` 分隔
  - 每行左侧 label（`font-numeric text-[11px] uppercase tracking-[0.14em]` + `var(--color-ink-mute)`），width 固定 e.g. `w-12 shrink-0`，让 chip 起始位置对齐
  - chip 按钮严格照抄 FilterChips active/inactive 两套 style 对象（见 PATTERNS_TO_MIRROR）
  - 默认 chip color 用 `var(--color-ink-2)`（不再加 type 色 tone —— 学科/年级是中性维度，不绑定 brand 色）
- **MIRROR**: `components/FilterChips.tsx` 全文（视觉骨架），但结构改成多行 + label-prefix
- **IMPORTS**: `'use client';`（容器是 controlled component，但 chip click 直接走 props.onChange，不持本地 state，理论上不需要 'use client'；但为风险最小一致 FilterChips，加上）
- **GOTCHA**:
  - **不**导入 `RecordType` —— 我们值域是字符串，不是枚举类型
  - 三行布局别用 grid（要 wrap），用 flex+flex-wrap
  - active state 一定要先于 inactive 写在 style 三元里 —— 切换 active 时 React 才能正确切换 style 对象
- **VALIDATE**: 在 `app/agents/page.tsx`（Task 5）渲染后，肉眼看 1m 投影距离 + 30cm 桌面距离 chip 都能识别；active chip 视觉与 FilterChips 在 /records 页一致（章式黑底白字）

### Task 5: CREATE `app/agents/page.tsx`

- **ACTION**: 新建全部智能体检索页
- **IMPLEMENT**:
  ```tsx
  'use client';

  import { Suspense, useEffect, useMemo, useState } from 'react';
  import { useSearchParams } from 'next/navigation';
  import Link from 'next/link';
  import { Topbar } from '@/components/Topbar';
  import { AgentCard } from '@/components/AgentCard';
  import { AgentFilters } from '@/components/AgentFilters';
  import {
    INITIAL_AGENTS,
    savedToSeed,
    type AgentSeed,
  } from '@/lib/agents-display';
  import type { SavedAgent } from '@/lib/agent-storage';

  const VALID_SUBJECTS = ['all', '科学', '人工智能'] as const;
  const VALID_GRADES = ['all', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级'] as const;
  const VALID_SORTS = ['lastUsed', 'createdAt'] as const;

  export default function AgentsPage() {
    return (
      <Suspense fallback={null}>
        <AgentsPageInner />
      </Suspense>
    );
  }

  function AgentsPageInner() {
    const sp = useSearchParams();
    const subject = readParam(sp.get('subject'), VALID_SUBJECTS, 'all');
    const grade   = readParam(sp.get('grade'),   VALID_GRADES,   'all');
    const sort    = readParam(sp.get('sort'),    VALID_SORTS,    'lastUsed');

    const [savedAgents, setSavedAgents] = useState<AgentSeed[]>([]);
    const [hiddenSeedIds, setHiddenSeedIds] = useState<Set<string>>(new Set());
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      let alive = true;
      fetch('/api/agents')
        .then(r => r.json())
        .then((d: { agents?: SavedAgent[]; hiddenSeedIds?: string[] }) => {
          if (!alive) return;
          if (Array.isArray(d.agents)) setSavedAgents(d.agents.map(savedToSeed));
          if (Array.isArray(d.hiddenSeedIds)) setHiddenSeedIds(new Set(d.hiddenSeedIds));
        })
        .catch(() => { /* 静默兜底 INITIAL_AGENTS */ })
        .finally(() => { if (alive) setLoaded(true); });
      return () => { alive = false; };
    }, []);

    const all = useMemo<AgentSeed[]>(() => {
      const seedAgents = INITIAL_AGENTS.filter(a => !hiddenSeedIds.has(a.id));
      return [...savedAgents, ...seedAgents];
    }, [savedAgents, hiddenSeedIds]);

    const filteredSorted = useMemo(() => {
      const filtered = all.filter(a =>
        (subject === 'all' || a.subject === subject) &&
        (grade   === 'all' || a.grade   === grade)
      );
      const key: keyof AgentSeed = sort === 'createdAt' ? 'createdAt' : 'lastUsedAt';
      return [...filtered].sort((a, b) => (a[key] < b[key] ? 1 : -1));
    }, [all, subject, grade, sort]);

    function setParam(key: string, value: string) {
      const params = new URLSearchParams(sp.toString());
      const isDefault =
        (key === 'subject' && value === 'all') ||
        (key === 'grade'   && value === 'all') ||
        (key === 'sort'    && value === 'lastUsed');
      if (isDefault) params.delete(key); else params.set(key, value);
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `/agents?${qs}` : '/agents');
    }

    return (
      <main className="min-h-screen" style={{ background: 'var(--color-paper-base)' }}>
        <Topbar />
        <div
          className="mx-auto w-full px-10 pt-10 pb-24"
          style={{ maxWidth: 'min(1480px, calc(100vw - 80px))' }}
        >
          <header
            className="mb-6 flex items-end gap-5 border-t pt-5"
            style={{ borderColor: 'var(--color-paper-rule)' }}
          >
            <span
              className="stamp h-10 w-10 shrink-0 text-[14px]"
              style={{ borderRadius: 'var(--radius-xs)' }}
              aria-hidden
            >
              ALL
            </span>
            <div className="flex flex-1 items-baseline gap-4 min-w-0">
              <h1
                className="font-display text-[28px] font-medium leading-none tracking-[0.5px]"
                style={{ color: 'var(--color-ink-1)' }}
              >
                全部智能体
              </h1>
              <p
                className="text-[14px] leading-snug truncate"
                style={{ color: 'var(--color-ink-3)' }}
              >
                按学科 / 年级 / 时间检索归档
              </p>
              {!loaded && (
                <span
                  className="font-numeric tnum text-[12px] shrink-0"
                  style={{ color: 'var(--color-ink-mute)' }}
                >
                  拉取远端中…
                </span>
              )}
            </div>
          </header>

          <AgentFilters
            subject={subject}
            grade={grade}
            sort={sort}
            resultHint={`共 ${filteredSorted.length} 个`}
            onSubjectChange={v => setParam('subject', v)}
            onGradeChange={v => setParam('grade', v)}
            onSortChange={v => setParam('sort', v)}
          />

          {filteredSorted.length > 0 ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {filteredSorted.map(a => (
                <AgentCard
                  key={a.id}
                  type={a.type}
                  avatar={a.avatar}
                  avatarUrl={a.avatarUrl}
                  bgUrl={a.bgUrl}
                  name={a.name}
                  subject={a.subject}
                  grade={a.grade}
                  lastUsed={a.lastUsed}
                  launchHref={a.launchHref}
                  editHref={`/edit/${a.id}`}
                  manageMode={false}
                  onDelete={() => {}}
                />
              ))}
            </div>
          ) : (
            loaded && (
              <div
                className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center"
                style={{
                  background: 'var(--color-paper-soft)',
                  border: '1px solid var(--color-paper-edge)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span
                  className="stamp h-10 w-10 text-[12px]"
                  style={{ borderRadius: 'var(--radius-xs)' }}
                  aria-hidden
                >
                  ø
                </span>
                <div
                  className="font-display text-[18px] font-medium"
                  style={{ color: 'var(--color-ink-1)' }}
                >
                  当前筛选下没有智能体
                </div>
                <div className="text-[13px]" style={{ color: 'var(--color-ink-3)' }}>
                  换个学科 / 年级试试，或者去{' '}
                  <Link
                    href="/create"
                    className="underline decoration-1 underline-offset-[3px]"
                    style={{ color: 'var(--color-type-dialogue-deep)' }}
                  >
                    AI 创建
                  </Link>{' '}
                  做一个
                </div>
              </div>
            )
          )}
        </div>
      </main>
    );
  }

  function readParam<T extends readonly string[]>(
    raw: string | null,
    valid: T,
    fallback: T[number],
  ): T[number] {
    if (raw && (valid as readonly string[]).includes(raw)) return raw as T[number];
    return fallback;
  }
  ```
- **MIRROR**:
  - `app/records/page.tsx:1–185`（外壳/Suspense/数据流/empty state 全套）
  - `app/page.tsx:389`（容器宽幅 inline style）
  - `app/page.tsx:470–479`（4 列 grid）
  - `app/page.tsx:293–305`（远端拉取 useEffect）
- **IMPORTS**: 见 IMPLEMENT 头部
- **GOTCHA**:
  - **必须**包 `<Suspense>` —— 不包 Next 16 prerender 阶段会炸（见 use-search-params.md）
  - 默认值（`'all'` / `'lastUsed'`）从 URL 删掉，而不是写进 URL —— 让分享链接保持干净
  - `window.history.replaceState` 不是 `pushState` —— 切 chip 不要每次推一格回退栈
  - 不要 catch fetch error 之后 setLoaded(true) 后还能渲染 INITIAL_AGENTS 兜底（设计就是这样的：远端挂了仍然展示 seed）
- **VALIDATE**:
  - `npx tsc --noEmit` 无报错
  - `npm run dev` → 浏览器开 `/agents`：
    - 默认渲染：14 卡（取决于 KV 数据；至少 8 张 seed），按 lastUsedAt desc，"刚刚" / "今天" 系排在前
    - 点"科学"chip：URL 变 `?subject=科学`，卡数收缩，排序保持
    - 点"五年级"chip：URL 变 `?subject=科学&grade=五年级`
    - 点"创建时间"chip：URL 加 `&sort=createdAt`，前部变成最新创建的
    - 点"全部"学科：URL 中的 `subject=` 消失（默认值清理）
    - 浏览器后退键：URL 不会回到上一筛选状态（因为用 replaceState；这是预期）
    - 刷新：URL 状态保留，UI 状态恢复
    - 选个不会有结果的组合（"人工智能" + "一年级"）：empty state 出现

### Task 6: UPDATE `components/Topbar.tsx` — 加"全部智能体"链接

- **ACTION**: 在第 58 行 `<nav>` 内最左侧插入第三条 Link
- **IMPLEMENT**:
  ```tsx
  <nav className="ml-4 flex items-center gap-6">
    {/* 全部智能体 = 按学科 / 年级 / 时间检索的归档页 */}
    <Link
      href="/agents"
      className="text-[17px] transition-colors hover:underline underline-offset-[8px] decoration-1"
      style={{ color: 'var(--color-ink-3)' }}
    >
      全部智能体
    </Link>
    {/* 我的产出 = prep 一类（教案/大纲/习题/活动/PBL）通过 ?filter=prep 落到记录页 */}
    <Link
      href="/records?filter=prep"
      ...
    >
      我的产出
    </Link>
    <Link
      href="/records"
      ...
    >
      我的记录
    </Link>
  </nav>
  ```
- **MIRROR**: 第 60–73 行的两条已有 Link 完全同款；只是把"全部智能体"插到最左
- **IMPORTS**: 已有 `import Link from 'next/link';`
- **GOTCHA**: 顺序是"全部智能体 → 我的产出 → 我的记录" —— 阅读语义：先看*智能体本体*（资产），再看*产出*（成品），再看*记录*（过程）。和首页 ① ② ③ 段同序（备课 / 授课 / 智能体使用）逻辑一致
- **VALIDATE**: `npm run dev` → 任意页（`/`、`/records`、`/edit/seed-curie`）顶栏出现"全部智能体"在最左；点击落 `/agents`

### Task 7: 视觉烟测（1m 投影 + 30cm 桌面双距测试）

- **ACTION**: 不写代码；按 CLAUDE.md 设计原则做距离测试
- **IMPLEMENT**:
  - 30cm 桌面：浏览器 100% 缩放，宽屏 1440 / 笔记本 1280 两种宽度各看一次
    - chip 文字 13px 应该清晰
    - active chip 章式黑底白字应该和 FilterChips 在 /records 页视觉对齐
    - 4 列卡片间距 16px，hover 浮起阴影正确
  - 1m 投影距离：把浏览器 zoom 到 150%（近似讲台到大屏的尺寸感），看
    - 标题"全部智能体" 28px display 字体远距能读
    - chip label 13px 在 150% zoom 后≈19.5px，远距勉强可读 —— 如果显著费力，把 chip 放大到 14px（仅那个组件）
    - 卡片名 18px display + meta 13px numeric，匹配首页观感
  - 反向检查：
    - 不出现 chrome+gradient+shadow 的 SaaS 套装（应该是描边 + 章式 stamp）
    - 不出现"四等大卡片连刷三屏"以外的新视觉噪声
    - 不滥用三色（学问蓝/辩论红/讨论青）—— 学科 / 年级 chip 必须是中性色
- **GOTCHA**: CLAUDE.md 锁死 light theme，不要被浏览器 prefers-color-scheme: dark 影响；如果出现深色，去 `app/globals.css` 检查 light 强制是否被新代码破坏
- **VALIDATE**: 截图 `/agents` 和 `/records` 同框对比，纸卡视觉一致

### Task 8: 提交（每个文件单原子 commit；按 P0 → 新文件 → 串联 → 文档顺序）

- **ACTION**: 不分动作，只描述提交粒度
- **IMPLEMENT**: 推荐 5 个 commits 的拓扑：
  1. `refactor: 抽出 INITIAL_AGENTS / savedToSeed 到 lib/agents-display + 加 ISO 时戳`
     （Task 1 + Task 2，保证首页表现 100% 不变；可独立部署回滚）
  2. `feat(agents): 新增 components/AgentFilters 多行 chip 筛选条`（Task 4）
  3. `feat(agents): 新增 /agents 页 — 学科/年级筛选 + 上次使用/创建时间排序`（Task 5）
  4. `nav: Topbar 增加"全部智能体"入口 + 首页"查看全部 →"接 /agents`（Task 3 + Task 6）
  5. （可选）若 Task 7 视觉烟测发现 chip 字号需调整，单独一个 `polish:` commit
- **GOTCHA**:
  - 第 1 个 commit 必须独立 ship safe（首页功能完全等价）—— 这是回滚边界
  - 第 4 个 commit 之前 `/agents` 页面已经能通过 URL 直访，但 UI 入口尚未铺路 —— 也 OK，但顺序写好后 review 体感更顺
- **VALIDATE**: `git status` 干净；`git log --oneline -5` 和上面 5 条一致

---

## Testing Strategy

项目里**没有 test runner**（package.json 无 jest / vitest / playwright；npm scripts 只有 dev/build/start）。所以 testing strategy 退化为：**type-check + manual smoke test**。

### Type-check Coverage

Task 1、2、4、5、6 每步必跑：

```bash
npx tsc --noEmit
```

### Manual Smoke Test Matrix

| 路径                                                | 期望                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `/`                                                 | 首页 ② 段卡序、视觉与重构前完全一致；右上"查看全部 →"hover 有 underline    |
| 点首页"查看全部 →"                                   | 落 `/agents`，URL 无 query                                                |
| `/agents`（默认）                                   | 4 列 grid；按 lastUsedAt desc；result hint "共 N 个"                      |
| `/agents?subject=科学`                              | 仅科学卡；URL 保留                                                        |
| `/agents?subject=科学&grade=五年级`                 | 双维度收敛；result hint 数字下降                                          |
| `/agents?sort=createdAt`                            | 按 createdAt desc；最新创建在前                                           |
| `/agents?subject=人工智能&grade=一年级`             | 通常空集 → empty state 出现，文案/链接正确                                |
| `/agents`，断网点击 chip                            | URL 变化但远端没拉到 → INITIAL_AGENTS 兜底渲染                             |
| `/agents?subject=BAD_VALUE`                         | 当作 `'all'` 处理（readParam fallback）                                   |
| 顶栏点"全部智能体"                                  | 任何页落 `/agents`                                                        |
| `/agents` 浏览器刷新                                | URL state 保留，UI 状态同步                                               |
| `/agents` 浏览器后退                                | 不回到上一 chip 状态（replaceState 设计如此）                             |
| `/agents` 点卡"启动"                                | 落 `/use/xuewen/{id}` 或 `/use/debate/{id}` 或 legacy HTML（与首页一致）  |

### Edge Cases Checklist

- [ ] KV 远端挂了 → INITIAL_AGENTS 兜底渲染
- [ ] KV 返回 0 saved agents（新部署）→ 仍显示 8 张 seed
- [ ] URL 带非法值（`subject=黑科学`）→ 视为默认 `'all'`
- [ ] URL 同名重复 key（`?subject=科学&subject=人工智能`）→ `URLSearchParams.get()` 取第一个，行为可预期
- [ ] 老师在 `/agents` 改 chip 后再点 Topbar 的"我的记录" → 切走时 URL 是带 query 的 `/agents?...`，回退栈正常
- [ ] 老师从 `/edit/{id}` 用浏览器后退到 `/agents` → 期望 URL 状态恢复（这部分依赖浏览器实现，replaceState 不影响后退到不同 origin path）
- [ ] 学科 / 年级筛选都为 'all' 但 sort 切到 createdAt → URL 只剩 `?sort=createdAt`
- [ ] AgentCard 在 manageMode=false 下"启动"按钮可点击 —— /agents 不开 manage 入口

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
npx tsc --noEmit
```

**EXPECT**: Exit 0，无报错。

> 备注：项目无 ESLint config（package.json 无 lint script），故跳过 lint 阶段。

### Level 2: UNIT_TESTS

跳过 —— 项目无 test framework。

### Level 3: BUILD

```bash
npm run build
```

**EXPECT**:
- Exit 0
- Build output 显示 `/agents` 路由被打包（route info 行包含 `/agents`）
- 无 SSG/Suspense 相关 warning

### Level 4: DATABASE_VALIDATION

不适用 —— 本期不动 KV schema。

### Level 5: BROWSER_VALIDATION

跑 `npm run dev` 后按 **Manual Smoke Test Matrix** 全部走一遍。

### Level 6: MANUAL_VALIDATION（设计校验）

按 **Task 7 视觉烟测** 双距测试。

---

## Acceptance Criteria

- [ ] 首页 ② 段"查看全部 →" 不再 toast，点击直跳 `/agents`
- [ ] 顶栏在任意非 crumb 页面出现"全部智能体"链接（最左）
- [ ] `/agents` 4 列卡片网格视觉与首页一致
- [ ] 学科 chip（全部 / 科学 / 人工智能）单选切换收敛卡片集
- [ ] 年级 chip（全部 / 一-六年级）单选切换收敛卡片集
- [ ] 排序 chip（上次使用 / 创建时间）切换重排卡片
- [ ] URL searchParams 准确反映 chip 状态；分享链接他人打开看到一致结果
- [ ] 默认值（subject=all / grade=all / sort=lastUsed）从 URL 自动清理
- [ ] 切 chip 不污染 history stack（replaceState）
- [ ] 空筛选结果 → 纸卡式 empty state 文案准确，AI 创建链接可点
- [ ] 远端挂了 → INITIAL_AGENTS 兜底渲染，不白屏
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过
- [ ] CLAUDE.md "design principles" 1m 投影 + 30cm 桌面双距测试均通过

---

## Completion Checklist

- [ ] Task 1: `lib/agents-display.ts` 抽取 + 扩字段，type-check 通过
- [ ] Task 2: `app/page.tsx` 删本地定义改 import，首页视觉无回归
- [ ] Task 3: `app/page.tsx` "查看全部 →" 改 Link
- [ ] Task 4: `components/AgentFilters.tsx` 多行 chip 组件
- [ ] Task 5: `app/agents/page.tsx` 全部智能体页（Suspense + URL state + 远端拉取 + empty state）
- [ ] Task 6: `components/Topbar.tsx` "全部智能体" 入口
- [ ] Task 7: 视觉双距烟测通过
- [ ] Task 8: 5 个原子 commit 拓扑提交
- [ ] Level 1（type-check）+ Level 3（build）+ Level 5（手动 smoke）全过
- [ ] All acceptance criteria 勾掉

---

## Risks and Mitigations

| Risk                                                                                | Likelihood | Impact | Mitigation                                                                                                       |
| ----------------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| Task 1 抽 INITIAL_AGENTS 时漏带 `getXuewenPersonaResolved` / `getTopicThumb` import | MED        | MED    | grep 当前 `app/page.tsx` 顶部 import；新模块顶部完整搬运。Task 2 完成后必跑 `npm run dev` 看首页 seed-curie 头像   |
| `updatedAt` 做"上次使用"代理 → 编辑 agent 后排到最前，老师疑惑                       | MED        | LOW    | 文档化（NOT_BUILDING 段已注明）；后续 phase 引入真 lastUsedAt + touch endpoint                                   |
| Suspense 没包好 → Next 16 prerender 阶段炸                                          | LOW        | HIGH   | 严格仿写 `/records` 页 Suspense 包裹模式；Task 5 build 步骤会暴露                                                |
| chip 字号在 1m 投影距离不可读                                                       | LOW        | MED    | Task 7 视觉烟测；备选 polish commit 把 chip 升到 14px                                                            |
| 用户切 chip 时浏览器后退键体验不符合预期（replaceState）                            | LOW        | LOW    | 这是 Next 16 文档明确推荐的客户端筛选模式；和 /records 页一致体验                                                |
| `URLSearchParams` 旧浏览器兼容                                                      | VERY LOW   | LOW    | 项目已用 React 19 + Next 16，目标浏览器肯定支持 URLSearchParams                                                  |
| ISO 字符串字典序排序边界情况（时区差）                                              | LOW        | LOW    | 所有时戳统一用 `Z` 后缀（UTC），ISO 8601 字典序==时间序，无歧义                                                  |
| KV `limit=50` 在数据量大时漏卡                                                      | LOW        | MED    | 当前数据规模 < 50；超过后再加分页（NOT_BUILDING 已注明）                                                         |

---

## Notes

### 设计决策依据

- **为什么不复用 `FilterChips`**：它的 `FilterValue` 类型导出绑死了 `RecordType`（`components/FilterChips.tsx:5`），值集合是 `'all' | 'dialogue' | 'debate' | 'discussion' | 'prep'`。要改成通用化要么破坏 /records 页的类型安全，要么加复杂的泛型 —— 复制视觉再做一个组件成本更低、可读性更高，符合"三相似行胜过过早抽象"。
- **为什么 `/agents` 而不是 `/all` 或 `/library`**：和 `/records` 在 mental model 上对称（产出 / 智能体），且 `/agents` 在英语里是 agent center 的资产名，最直接。
- **为什么 sort 是 segmented 而不是 dropdown**：dropdown 是 SaaS 后台风格（Ant/Element 的自带物），违反 anti-references。chip 段化 segmented 更接近"档案册分页卡"的物理隐喻。
- **为什么先 sort 行后 filter 行**：阅读重心从"我要按什么序看"开始，再细化"看哪一支"。这与 editorial hierarchy（先大重心再细化）一致。
- **为什么默认 sort 是 lastUsed 而不是 createdAt**：老师每天打开"全部智能体"是为了"找用过的那张"，不是"找最新建的"。

### 后续 phase 可加（非本期）

- 真 `lastUsedAt` 字段 + `POST /api/agents/[id]/touch`
- 类型 chip（学问 / 辩论 / 讨论）—— 在 `AgentFilters` props 里留好可扩位
- 多选筛选（Cmd-click 或 chip 上加 `×`）
- 响应式断点（首页 + /agents 一起改）
- 全文检索（智能体名称 / topic 关键词）
- 服务端筛选 + 分页（数据 > 100 卡时）
- "上次使用 N 天前" 的人类字符串与 ISO 同步显示在 AgentCard 上
