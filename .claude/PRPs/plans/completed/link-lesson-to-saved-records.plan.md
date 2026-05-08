# Feature: 保存记录关联到课节（Link Saved Records to Lesson Sections）

## Summary

When the lesson-prep workflow saves a record (a generated prep document, a Xuewen
dialogue, or a debate session), let the teacher attach it to a 课节 (lesson section).
Persist the link as `meta.lessonId` on the record and an inverse-index Set
`records:byLesson:{lessonId}` in KV. **The "view records under a lesson" UI is out
of scope** — only the linkage and an inline picker on the three save flows are built.

## User Story

As a teacher using the prep-and-use workflow,
I want to attach the thing I just generated (a lesson plan, a dialogue, or a debate)
to a specific 课节
So that future versions of the records page can group what I made under the lesson it
belongs to, even though that grouped view is not built yet.

## Problem Statement

Today every saved record (`AppRecord` in `lib/types.ts:30-73`) is a flat row in
`records:list`. The codebase has zero reference to a 课节 / lesson / course
(grep for `lessonId|courseId|课节|课程` returns only marketing copy in
`app/layout.tsx:15` and prompts in `lib/prep-prompts.ts:3`). When a teacher prepares
4–5 artifacts for one lesson (outline → lesson plan → exercise → in-class dialogue →
debate replay), there is no way to declare "all of these belong to '光的反射'." Demo
data in `lib/fallback-records.ts:8-56` already smuggles `meta: { 学科, 年级 }` but
nothing identifies the actual lesson.

## Solution Statement

1. Introduce a minimal `Lesson` type with **id / title / subject / grade**, seeded with
   ~5 demo lessons (mirrors the `SEED_AGENTS` pattern in `lib/agent-storage.ts:64-80`).
2. Store lessons in KV under `lesson:{id}` + `lessons:list`, with seed-fallback when
   `KV_REST_API_*` env vars are absent (same dual-mode shape as `lib/kv.ts`).
3. Expose `GET /api/lessons` for the picker.
4. Add a **first-class** optional field `lessonId?: string` on `BaseRecord` (do not
   smuggle through `meta` — first-class makes the inverse-index writer in `createRecord`
   clean and the future grouped view trivial).
5. In `createRecord` (`lib/kv.ts:39-50`), when `lessonId` is present, also write
   `kv.sadd('records:byLesson:{lessonId}', id)` — exact mirror of the existing
   `addHiddenFallbackRecordId` pattern at `lib/kv.ts:68-74`.
6. Build a `LessonPicker` client component used in the topbar `right` slot (use pages)
   and next to `SaveButton` (prep page). Default is "未关联课节"; selecting a lesson
   threads `lessonId` into the existing fetch payloads.

No Zod migration on the records route — keep the existing manual validation style at
`app/api/records/route.ts:30` so the new field stays consistent with the codebase.

## Metadata

| Field            | Value                                                           |
| ---------------- | --------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                  |
| Complexity       | MEDIUM                                                          |
| Systems Affected | KV layer, records API, prep page, both use pages, types         |
| Dependencies     | `@vercel/kv@3.0.0`, `next@16.2.6`, `react@19.2.4` (all existing) |
| Estimated Tasks  | 9                                                               |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  /prep/lesson  ·  /use/xuewen/[id]  ·  /use/debate/[id]                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────────────┐                ┌──────────────────┐                 ║
║   │  Topbar             │                │  [结束并保存]    │ ──┐             ║
║   │  crumb · 工具名     │ ─ click  ────► │  / SaveButton    │   │             ║
║   └─────────────────────┘                └──────────────────┘   │             ║
║                                                                  ▼             ║
║                                       POST /api/records                       ║
║                                       body: { type, title, summary,           ║
║                                                meta: { 学科, 年级, … } }      ║
║                                                  │                            ║
║                                                  ▼                            ║
║                                       createRecord()                          ║
║                                          ├─ kv.set('record:r_…', record)      ║
║                                          └─ kv.lpush('records:list', id)      ║
║                                                  │                            ║
║                                                  ▼                            ║
║                                       toast '已保存…' → /records              ║
║                                                                               ║
║   USER_FLOW: Click save → POST → toast → redirect.                            ║
║   PAIN_POINT: Records pile up flat. No way to say "this is for 光的反射."     ║
║   DATA_FLOW: meta carries 学科/年级 strings only — no lesson identity.        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  /prep/lesson  ·  /use/xuewen/[id]  ·  /use/debate/[id]                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────────────┐    ┌─────────────────────┐    ┌──────────────────┐  ║
║   │  Topbar             │    │ LessonPicker (NEW)  │    │ [结束并保存]     │  ║
║   │  crumb · 工具名     │    │ "归档到：光的反射 ▾"│    │ / SaveButton     │  ║
║   └─────────────────────┘    └─────────────────────┘    └──────────────────┘  ║
║                                       │                          │            ║
║                                       │ on mount: GET /api/lessons│            ║
║                                       ▼                          │            ║
║                                 [ 不关联 / 5 lessons ]           │            ║
║                                       │                          │            ║
║                                       └──────► lessonId state ◄──┘            ║
║                                                                  │            ║
║                                                                  ▼            ║
║                            POST /api/records                                  ║
║                            body: { …existing,  lessonId: 'l-light-refl' }     ║
║                                                  │                            ║
║                                                  ▼                            ║
║                            createRecord()                                     ║
║                              ├─ kv.set('record:r_…', record)                  ║
║                              ├─ kv.lpush('records:list', id)                  ║
║                              └─ if lessonId: kv.sadd('records:byLesson:l-…',  ║
║                                                        id)             (NEW)  ║
║                                                  │                            ║
║                                                  ▼                            ║
║                            toast '已保存到「光的反射」' → /records            ║
║                                                                               ║
║   USER_FLOW: Pick lesson (or skip) → save → save with linkage → toast.        ║
║   VALUE_ADD: Future records-by-lesson view becomes a single SMEMBERS read.    ║
║   DATA_FLOW: lessonId is first-class; inverse index makes grouped reads O(1). ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                         | Before                                 | After                                                                  | User Impact                                            |
| -------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `components/PrepToolPage.tsx:122-127` (Topbar `right`) | Just `<SaveButton/>`               | `<LessonPicker/>` next to `<SaveButton/>`                              | Can pick 课节 before clicking 保存                     |
| `components/XuewenUsePage.tsx:158-174`                  | Inline 结束并保存 button only      | `<LessonPicker/>` left of the inline button                            | Can pick 课节 before clicking 结束并保存               |
| `components/DebateUsePage.tsx` (Topbar `right`)         | Inline 结束并保存 button only      | `<LessonPicker/>` left of the inline button                            | Same                                                   |
| `POST /api/records`              | Stores record + lpush list             | Same, plus optional `kv.sadd('records:byLesson:{lessonId}', id)`       | None (silent extra write)                              |
| Toast text                       | `已保存…`                              | `已保存到「{lesson.title}」` when lessonId present, else unchanged     | Clear confirmation of linkage                          |

---

## Mandatory Reading

The implementing agent MUST read these before starting:

| Priority | File                                            | Lines  | Why                                                                              |
| -------- | ----------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| P0       | `lib/kv.ts`                                     | 1-83   | The KV store + dual-mode `_mem` fallback pattern to mirror in `lib/lessons.ts`. Also where the inverse-index sadd is added. |
| P0       | `lib/agent-storage.ts`                          | 1-80   | The `SEED_AGENTS` Record + `globalThis` mem singleton — exact pattern for `lib/lessons.ts`. |
| P0       | `lib/types.ts`                                  | 30-73  | `BaseRecord` and the `AppRecord` discriminated union — where `lessonId?` lands.  |
| P0       | `app/api/records/route.ts`                      | 23-40  | The manual-validation POST shape; new `lessonId` field plugs in here.            |
| P0       | `app/api/agents/route.ts`                       | 1-40   | Mirror this exact shape for the new `app/api/lessons/route.ts` GET handler.      |
| P1       | `components/PrepToolPage.tsx`                   | 60-127 | Save state + `handleSave` + Topbar `right` slot — picker placement.              |
| P1       | `components/XuewenUsePage.tsx`                  | 103-175 | Save handler + inline button placement.                                          |
| P1       | `components/DebateUsePage.tsx`                  | 320-380 | Save handler. Locate the Topbar `right` slot near these lines.                  |
| P1       | `components/SaveButton.tsx`                     | 1-51   | The visual idiom (paper button, saved/saving states) for picker styling.         |
| P1       | `lib/fallback-records.ts`                       | 1-60   | Demo-data pattern to follow for `lib/fallback-lessons.ts`.                       |
| P2       | `components/ConfirmModal.tsx`                   | 1-50   | Tokens reference: `var(--color-paper-card)`, `var(--color-paper-rule)` etc.      |
| P2       | `CLAUDE.md` Design Context                      | all    | Light-only, paper material, anti-references — keep picker visually consistent.   |

**External documentation:** none required — the feature uses only patterns already in
this codebase (`@vercel/kv@3.0.0` `kv.sadd` is already used at `lib/kv.ts:73` and
`@upstash/redis` types are inherited as confirmed by `node_modules/.pnpm/@vercel+kv@3.0.0/node_modules/@vercel/kv/dist/index.d.ts:1-25`).

---

## Patterns to Mirror

**KV_DUAL_MODE_STORE** (this is the load-bearing pattern for `lib/lessons.ts`):

```typescript
// SOURCE: lib/agent-storage.ts:9-56
// COPY THIS PATTERN — globalThis-pinned mem + KV passthrough + seed fallback:

const AGENTS_LIST_KEY = 'agents:list';
const AGENT_TTL_SEC = 60 * 60 * 24 * 90;

const HAS_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type Mem = { store: Map<string, SavedAgent>; list: string[] };
const _G = globalThis as unknown as { __agentMem?: Mem };
const _mem: Mem =
  _G.__agentMem ??
  (_G.__agentMem = {
    store: new Map<string, SavedAgent>(),
    list: [],
  });

export async function listAgents(limit = 50): Promise<SavedAgent[]> {
  if (!HAS_KV) {
    return _mem.list
      .slice(0, limit)
      .map(id => _mem.store.get(id))
      .filter((r): r is SavedAgent => !!r);
  }
  const ids = await kv.lrange<string>(AGENTS_LIST_KEY, 0, limit - 1);
  if (!ids?.length) return [];
  const items = await Promise.all(ids.map(id => kv.get<SavedAgent>(`agent:${id}`)));
  return items.filter((r): r is SavedAgent => r !== null && r !== undefined);
}

export async function getAgent(id: string): Promise<SavedAgent | null> {
  if (!HAS_KV) return _mem.store.get(id) ?? SEED_AGENTS[id] ?? null;
  const r = await kv.get<SavedAgent>(`agent:${id}`);
  return r ?? SEED_AGENTS[id] ?? null;
}
```

**INVERSE_INDEX_SET_WRITE** (the new one-line addition inside `createRecord`):

```typescript
// SOURCE: lib/kv.ts:68-74 — addHiddenFallbackRecordId
// COPY THIS PATTERN for the records:byLesson:{id} write:

export async function addHiddenFallbackRecordId(id: string): Promise<void> {
  if (!HAS_KV) {
    _mem.hiddenFallback.add(id);
    return;
  }
  await kv.sadd(HIDDEN_FALLBACK_KEY, id);
}
```

**ROUTE_GET_HANDLER** (for `app/api/lessons/route.ts`):

```typescript
// SOURCE: app/api/agents/route.ts:9-17
// COPY THIS PATTERN — including runtime export and the {items, error} shape:

export const runtime = 'nodejs';

export async function GET() {
  try {
    const agents = await listAgents(50);
    return NextResponse.json({ agents });
  } catch (e) {
    console.error('list agents failed', e);
    return NextResponse.json({ agents: [], error: 'kv_unavailable' }, { status: 200 });
  }
}
```

**SAVE_HANDLER_THREADING** (the prep page save body):

```typescript
// SOURCE: components/PrepToolPage.tsx:82-119
// AFTER: thread lessonId into the body and the toast:

async function handleSave() {
  const content = lastAssistantText(messages);
  if (!content) {
    toast('还没有内容可保存');
    return;
  }
  setSaving(true);
  try {
    const title = `${saveTitleStem}${PREP_KIND_TITLE_SUFFIX[kind]}`;
    const meta: Record<string, string> = {};
    contextFields.forEach(f => { meta[f.label] = f.value; });
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'prep',
        kind,
        title,
        summary: content.replace(/\s+/g, ' ').slice(0, 60),
        agentName: toolName,
        avatar: title.charAt(0),
        meta,
        content,
        lessonId: selectedLessonId ?? undefined,   // <— NEW (top-level, not in meta)
      }),
    });
    // …unchanged…
  }
}
```

**TOPBAR_RIGHT_SLOT** (where the picker mounts):

```typescript
// SOURCE: components/PrepToolPage.tsx:122-127
<Topbar
  crumb={toolName}
  showRecordsNav={false}
  right={
    <div className="flex items-center gap-3">
      <LessonPicker value={selectedLessonId} onChange={setSelectedLessonId} />
      <SaveButton saved={saved} saving={saving} onSave={handleSave} />
    </div>
  }
/>
```

**SEED_DATA_SHAPE** (for `lib/fallback-lessons.ts`):

```typescript
// SOURCE: lib/fallback-records.ts:8-32
// MIRROR THIS PATTERN — Chinese-named fields, ISO createdAt, stable ids:

export const FALLBACK_RECORDS: AppRecord[] = [
  {
    id: 'p1',
    type: 'prep',
    kind: 'outline',
    title: '水的三态变化课件大纲',
    summary: '导入/讲授/动手实验/小结 · 4 环节 · 总 40 分钟',
    time: '2026-05-08 16:00 · 今天',
    createdAt: '2026-05-08T16:00:00Z',
    agentName: '课件大纲规划',
    avatar: '课',
    meta: { 学科: '科学', 年级: '三年级' },
  },
  // …
];
```

---

## Files to Change

| File                                          | Action | Justification                                                                          |
| --------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `lib/types.ts`                                | UPDATE | Add `Lesson` interface (top-level export) + `lessonId?: string` to `BaseRecord`        |
| `lib/fallback-lessons.ts`                     | CREATE | 5 demo lessons that match the existing `meta: { 学科, 年级 }` strings on records       |
| `lib/lessons.ts`                              | CREATE | KV CRUD for lessons + seed fallback — mirrors `lib/agent-storage.ts`                   |
| `lib/kv.ts`                                   | UPDATE | Add inverse-index write inside `createRecord` (and `_mem` parallel)                    |
| `app/api/lessons/route.ts`                    | CREATE | `GET` only — returns `{ lessons: Lesson[] }`. Mirrors `app/api/agents/route.ts`        |
| `app/api/records/route.ts`                    | UPDATE | No code change strictly required (body is typed `Omit<AppRecord, …>`); spot-check that `lessonId` flows through. Optional: add to manual validation. |
| `components/LessonPicker.tsx`                 | CREATE | New client component — fetch + select control with paper styling                       |
| `components/PrepToolPage.tsx`                 | UPDATE | Hold `selectedLessonId` state, render `LessonPicker` next to `SaveButton`, thread into `handleSave` |
| `components/XuewenUsePage.tsx`                | UPDATE | Same — picker into Topbar `right`, thread into `handleEndAndSave`                      |
| `components/DebateUsePage.tsx`                | UPDATE | Same — picker into Topbar `right`, thread into `endAndSave`                            |

---

## NOT Building (Scope Limits)

These items are explicitly out of scope per the task brief
("后面可以在该课程下看到（这个部分不用做）"):

- **Lesson list page or "records under lesson" detail page.** No new route under `/lessons` or modification of `/records`.
- **Lesson CRUD admin UI.** No way for the user to create/edit/delete lessons in the UI; the seed list is canonical for the demo.
- **Migration of existing fallback records.** `FALLBACK_RECORDS` does not get retroactive `lessonId` values — leaving them as soft-orphans is fine and matches the empty-state feel.
- **Backfill or change to the `agentName`-based grouping** that already exists.
- **Zod migration on `/api/records`.** Keep the manual `if (!body.type || !body.title)` style for consistency with `app/api/agents/route.ts:27-32`.
- **TTL on inverse index keys.** `kv.sadd` writes are TTL-less here; record TTL (30 days) handles eventual cleanup naturally — orphaned set members are tolerable for the demo.
- **`DELETE` cleanup of inverse index.** `deleteRecord` (`lib/kv.ts:52-61`) does not need to `srem` because the future view will defensively dereference and skip nulls.

---

## Step-by-Step Tasks

Execute top-to-bottom. Each task is independently verifiable.

### Task 1: UPDATE `lib/types.ts` — add `Lesson` and `lessonId?`

- **ACTION**: Add a `Lesson` interface and an optional `lessonId?: string` field to `BaseRecord`.
- **IMPLEMENT**: Insert after the existing `RecordType` definition, near `lib/types.ts:5`:
  ```typescript
  export interface Lesson {
    id: string;          // 'l_…' or stable seed slug like 'l-light-reflection'
    title: string;       // '光的反射'
    subject: string;     // '科学'
    grade: string;       // '三年级'
    createdAt?: string;  // ISO string; optional for seeded items
  }
  ```
  Add to `BaseRecord` (`lib/types.ts:30-41`), as an optional field next to `meta`:
  ```typescript
  lessonId?: string;     // 关联课节的 id（对应 lib/lessons.ts）
  ```
- **MIRROR**: `lib/types.ts:30-41` for the optional-field convention (keep `?` + a one-line Chinese comment).
- **GOTCHA**: Do NOT remove `meta` or move `lessonId` into `meta`. First-class lets the route handler in Task 4 do `body.lessonId` cleanly.
- **VALIDATE**: `npx tsc --noEmit` — no type errors. The discriminated union on `AppRecord` (lib/types.ts:69-73) inherits the new field automatically.

### Task 2: CREATE `lib/fallback-lessons.ts`

- **ACTION**: New file with ~5 seed lessons whose `subject`/`grade` match the strings already in `lib/fallback-records.ts:19,31,43,55`.
- **IMPLEMENT**:
  ```typescript
  import type { Lesson } from './types';

  export const FALLBACK_LESSONS: Lesson[] = [
    { id: 'l-light-reflection', title: '光的反射', subject: '科学', grade: '三年级', createdAt: '2026-04-30T08:00:00Z' },
    { id: 'l-water-states',     title: '水的三态变化', subject: '科学', grade: '三年级', createdAt: '2026-04-29T08:00:00Z' },
    { id: 'l-animal-class',     title: '动物分类', subject: '科学', grade: '三年级', createdAt: '2026-04-28T08:00:00Z' },
    { id: 'l-magnet',           title: '磁铁的两极', subject: '科学', grade: '二年级', createdAt: '2026-04-27T08:00:00Z' },
    { id: 'l-circuit',          title: '简单电路', subject: '科学', grade: '四年级', createdAt: '2026-04-26T08:00:00Z' },
  ];
  ```
- **MIRROR**: `lib/fallback-records.ts:8-56` (named-export array, stable string ids, ISO `createdAt`).
- **GOTCHA**: Stable seed ids start with `l-` (slug-style), not `l_…` (random). The slug ids let the inverse-index keys read like `records:byLesson:l-light-reflection` in dev.
- **VALIDATE**: `npx tsc --noEmit`.

### Task 3: CREATE `lib/lessons.ts`

- **ACTION**: New module: dual-mode KV store + seed fallback for lessons.
- **IMPLEMENT**:
  ```typescript
  import { kv } from '@vercel/kv';
  import type { Lesson } from './types';
  import { FALLBACK_LESSONS } from './fallback-lessons';

  const LESSONS_LIST_KEY = 'lessons:list';
  const LESSON_TTL_SEC = 60 * 60 * 24 * 90; // 90 days, parity with agents

  const HAS_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  type Mem = { store: Map<string, Lesson>; list: string[] };
  const _G = globalThis as unknown as { __lessonMem?: Mem };
  const _mem: Mem =
    _G.__lessonMem ??
    (_G.__lessonMem = { store: new Map<string, Lesson>(), list: [] });

  const SEED_LESSONS: Record<string, Lesson> = Object.fromEntries(
    FALLBACK_LESSONS.map(l => [l.id, l]),
  );

  export async function listLessons(limit = 50): Promise<Lesson[]> {
    if (!HAS_KV) {
      const fromMem = _mem.list
        .slice(0, limit)
        .map(id => _mem.store.get(id))
        .filter((l): l is Lesson => !!l);
      // Seed fills the tail so the picker is never empty in demo mode
      const merged = [...fromMem];
      for (const l of FALLBACK_LESSONS) if (!merged.find(m => m.id === l.id)) merged.push(l);
      return merged.slice(0, limit);
    }
    const ids = await kv.lrange<string>(LESSONS_LIST_KEY, 0, limit - 1);
    const fromKv = ids?.length
      ? (await Promise.all(ids.map(id => kv.get<Lesson>(`lesson:${id}`)))).filter(
          (l): l is Lesson => l !== null && l !== undefined,
        )
      : [];
    const merged = [...fromKv];
    for (const l of FALLBACK_LESSONS) if (!merged.find(m => m.id === l.id)) merged.push(l);
    return merged.slice(0, limit);
  }

  export async function getLesson(id: string): Promise<Lesson | null> {
    if (!HAS_KV) return _mem.store.get(id) ?? SEED_LESSONS[id] ?? null;
    const r = await kv.get<Lesson>(`lesson:${id}`);
    return r ?? SEED_LESSONS[id] ?? null;
  }
  ```
- **MIRROR**: `lib/agent-storage.ts:9-56` — the dual-mode pattern, the `globalThis` mem pin, and the seed-fallback `?? SEED_*[id] ?? null` chain.
- **GOTCHA**: The merged-with-seed read order in `listLessons` matters: KV-or-mem first, seed fills the tail. This makes user-created lessons (none in this milestone, but supported by shape) appear first while still showing demo lessons.
- **GOTCHA**: Do NOT introduce `createLesson` — the user explicitly said the lesson-management UI is out of scope. Seed list is canonical.
- **VALIDATE**: `npx tsc --noEmit`.

### Task 4: UPDATE `lib/kv.ts` — write inverse index inside `createRecord`

- **ACTION**: Inside `createRecord` (`lib/kv.ts:39-50`) and the `deleteRecord` no-op for now, write to a `records:byLesson:{lessonId}` Set when `input.lessonId` is present. Both KV and `_mem` branches need the parallel write.
- **IMPLEMENT**: After line 41 (where `record` is constructed), and inside both branches:
  ```typescript
  // Add at top of file, near LIST_KEY:
  const BY_LESSON_KEY_PREFIX = 'records:byLesson:';

  // Extend _mem to track per-lesson sets:
  const _mem = {
    store: new Map<string, AppRecord>(),
    list: [] as string[],
    hiddenFallback: new Set<string>(),
    byLesson: new Map<string, Set<string>>(),  // NEW
  };

  // Modified createRecord:
  export async function createRecord(input: Omit<AppRecord, 'id' | 'createdAt'>): Promise<AppRecord> {
    const id = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = { ...input, id, createdAt: new Date().toISOString() } as AppRecord;
    const lessonId = (record as { lessonId?: string }).lessonId;

    if (!HAS_KV) {
      _mem.store.set(id, record);
      _mem.list.unshift(id);
      if (lessonId) {
        let set = _mem.byLesson.get(lessonId);
        if (!set) { set = new Set(); _mem.byLesson.set(lessonId, set); }
        set.add(id);
      }
      return record;
    }
    await kv.set(`record:${id}`, record, { ex: RECORD_TTL_SEC });
    await kv.lpush(LIST_KEY, id);
    if (lessonId) {
      await kv.sadd(`${BY_LESSON_KEY_PREFIX}${lessonId}`, id);
    }
    return record;
  }
  ```
- **MIRROR**: `lib/kv.ts:68-74` (`addHiddenFallbackRecordId`) for the conditional-Set-write idiom.
- **GOTCHA**: Read `lessonId` off `record`, not `input`. After `{...input}` spread the merged value lives on `record` and the cast `(record as { lessonId?: string })` keeps types narrow without changing `AppRecord` to require the field on every variant.
- **GOTCHA**: KV write order is intentional — record blob first, then list, then index. If sadd fails the record is still listable.
- **VALIDATE**: `npx tsc --noEmit && pnpm next build` — build must succeed; no test runner exists in this repo (`package.json` has only `dev`/`build`/`start`).

### Task 5: CREATE `app/api/lessons/route.ts`

- **ACTION**: New `GET` route returning `{ lessons }`.
- **IMPLEMENT**:
  ```typescript
  import { NextResponse } from 'next/server';
  import { listLessons } from '@/lib/lessons';

  export const runtime = 'nodejs';

  export async function GET() {
    try {
      const lessons = await listLessons(50);
      return NextResponse.json({ lessons });
    } catch (e) {
      console.error('list lessons failed', e);
      return NextResponse.json({ lessons: [], error: 'kv_unavailable' }, { status: 200 });
    }
  }
  ```
- **MIRROR**: `app/api/agents/route.ts:1-17` — exact response shape, exact try/catch structure, exact `runtime = 'nodejs'` export.
- **GOTCHA**: This file MUST live at `app/api/lessons/route.ts` (note `route.ts`, not `route.tsx` — pattern from existing routes).
- **VALIDATE**: `pnpm dev` then `curl http://localhost:3000/api/lessons` → expect `{"lessons":[{"id":"l-light-reflection",…}, …]}`.

### Task 6: UPDATE `app/api/records/route.ts` — accept `lessonId` (verify pass-through)

- **ACTION**: No structural change required — `body` is typed `Omit<AppRecord, 'id' | 'createdAt'>` (`route.ts:24`) and after Task 1 that union now includes `lessonId?`. Confirm by reading the route and adding ONE optional sanity log line.
- **IMPLEMENT**: Optionally augment the existing manual check at line 30 (do not add Zod):
  ```typescript
  if (!body.type || !body.title) {
    return NextResponse.json({ error: 'type and title required' }, { status: 400 });
  }
  if (body.lessonId !== undefined && typeof body.lessonId !== 'string') {
    return NextResponse.json({ error: 'lessonId must be a string' }, { status: 400 });
  }
  ```
- **MIRROR**: `app/api/records/route.ts:30-32` for the inline-check style (string error in NextResponse.json with 400).
- **GOTCHA**: Resist adding Zod here. The codebase's records/agents routes both use manual checks; introducing Zod in one route diverges from the `lib/agent-schemas.ts`-only conventions documented in `lib/agent-schemas.ts:1-3`.
- **VALIDATE**: `npx tsc --noEmit`.

### Task 7: CREATE `components/LessonPicker.tsx`

- **ACTION**: New client component: select-style picker for the topbar.
- **IMPLEMENT**:
  ```typescript
  'use client';

  import { useEffect, useState } from 'react';
  import type { Lesson } from '@/lib/types';

  interface Props {
    value: string | null;
    onChange: (id: string | null) => void;
  }

  /**
   * 课节归档选择器 · 顶栏右侧
   * - paper-card 底，paper-rule 边线，font-display 字
   * - 默认 '不关联课节'，选中后蓝色（学问蓝 var(--color-type-dialogue)）小圆点
   * - 远程 GET /api/lessons 失败时静默隐藏（保存流程仍可走）
   */
  export function LessonPicker({ value, onChange }: Props) {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      let alive = true;
      fetch('/api/lessons')
        .then(r => r.json())
        .then((data: { lessons?: Lesson[] }) => {
          if (!alive) return;
          setLessons(data.lessons ?? []);
          setLoaded(true);
        })
        .catch(() => alive && setLoaded(true));
      return () => { alive = false; };
    }, []);

    if (!loaded || lessons.length === 0) return null;

    return (
      <label
        className="flex h-10 items-center gap-2 px-3 text-[13px]"
        style={{
          background: 'var(--color-paper-card)',
          border: '1px solid var(--color-paper-rule)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-ink-1)',
        }}
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{
            background: value ? 'var(--color-type-dialogue)' : 'var(--color-paper-rule)',
          }}
        />
        <span className="font-numeric text-[10px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--color-ink-mute)' }}>
          归档至
        </span>
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className="bg-transparent outline-none cursor-pointer font-display"
          style={{ color: 'var(--color-ink-1)' }}
        >
          <option value="">不关联课节</option>
          {lessons.map(l => (
            <option key={l.id} value={l.id}>
              {l.title} · {l.grade}{l.subject}
            </option>
          ))}
        </select>
      </label>
    );
  }
  ```
- **MIRROR**: `components/SaveButton.tsx:1-51` for the props-only pattern, the `'use client'` directive, and the paper-token styling. Token references match `components/ConfirmModal.tsx:34-43`.
- **GOTCHA**: Render `null` when no lessons load — never break save when `/api/lessons` is down.
- **GOTCHA**: Native `<select>` is intentionally simple. Custom dropdown UI is a future polish task (not in scope per CLAUDE.md "Editorial hierarchy beats card uniformity" — keep chrome low).
- **GOTCHA**: Anti-references in `CLAUDE.md` ban Inter/Plus Jakarta etc. — `font-display` and `font-numeric` are project tokens defined in `app/globals.css`. Do NOT add new font imports.
- **VALIDATE**: `npx tsc --noEmit`.

### Task 8: UPDATE `components/PrepToolPage.tsx` — wire picker into save

- **ACTION**: Hold `selectedLessonId`, render picker next to `SaveButton`, thread `lessonId` into the POST body and toast.
- **IMPLEMENT**: Three edits inside `components/PrepToolPage.tsx`:
  1. After line 60 (state declarations):
     ```typescript
     const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
     ```
  2. Replace the Topbar `right` prop (line 126) with:
     ```typescript
     right={
       <div className="flex items-center gap-3">
         <LessonPicker value={selectedLessonId} onChange={setSelectedLessonId} />
         <SaveButton saved={saved} saving={saving} onSave={handleSave} />
       </div>
     }
     ```
  3. Inside `handleSave` (line 96-105), append `lessonId: selectedLessonId ?? undefined` to the JSON body. Update toast at line 112:
     ```typescript
     toast(selectedLessonId
       ? `已保存到「${title}」`            // (lesson title is unknown here without a lookup;
       : `已保存：${title}`);              //  see GOTCHA — prefer the simple form for now)
     ```
  - Add the import: `import { LessonPicker } from './LessonPicker';`
- **MIRROR**: `components/PrepToolPage.tsx:122-127` — the existing `right` slot exactly.
- **GOTCHA**: Resetting `selectedLessonId` on `messages.length` change (mirrors line 71-74 `setSaved(false)` reset) is **explicitly NOT done** — selection should survive new turns so the user doesn't have to re-pick. Treat the picker as a separate concern from save state.
- **GOTCHA**: To get the lesson title for the toast, you would need a second lookup — skip it. Show `已保存：{title}` regardless. The picker visually confirms the link.
- **VALIDATE**: `npx tsc --noEmit && pnpm next build`. Then `pnpm dev`, navigate `/prep/lesson`, verify picker renders, save, observe POST body in Network tab includes `lessonId`.

### Task 9: UPDATE `components/XuewenUsePage.tsx` and `components/DebateUsePage.tsx`

- **ACTION**: Same three edits as Task 8 — held `selectedLessonId`, picker mounted in the Topbar `right` slot beside the inline 结束并保存 button, `lessonId` threaded into the existing POST body.
- **IMPLEMENT (Xuewen)**: In `components/XuewenUsePage.tsx`:
  1. Add state near the existing `saving`/`messages` declarations (search for `useState`).
  2. Wrap the existing Topbar `right` JSX (lines 159-173) with:
     ```typescript
     right={
       <div className="flex items-center gap-3">
         <LessonPicker value={selectedLessonId} onChange={setSelectedLessonId} />
         <button onClick={handleEndAndSave} … >  {/* unchanged inline button */}
           …
         </button>
       </div>
     }
     ```
  3. Inside `handleEndAndSave` (line 117-138), add `lessonId: selectedLessonId ?? undefined` to the JSON body alongside `meta`.
  4. Import `LessonPicker`.
- **IMPLEMENT (Debate)**: Same shape in `components/DebateUsePage.tsx`. Locate the Topbar `right` slot (look near where `endAndSave` is wired into a button — likely around line 580+ based on `wc -l` output of 580+ lines and the analyst's note at `:581`). Apply the same wrap.
- **MIRROR**: `components/XuewenUsePage.tsx:155-174` for the topbar shape; `components/DebateUsePage.tsx:320-378` for the save handler shape.
- **GOTCHA**: Use pages redirect via `setTimeout(() => router.push('/records'), 700)` after success (`XuewenUsePage.tsx:144`, `DebateUsePage.tsx:371`). The picker's selection is implicitly thrown away on redirect — that's correct.
- **GOTCHA**: The picker renders `null` if no lessons — keep the inline button always visible. Don't conditionally hide the save button on picker state.
- **VALIDATE**: `npx tsc --noEmit && pnpm next build`. Then `pnpm dev`:
  - `/use/xuewen/seed-curie` → say something → 结束并保存 → Network tab shows `lessonId` in body.
  - `/use/debate/seed-plastic-ban` → run a round → judge → 结束并保存 → same check.

---

## Testing Strategy

The repo has **no test runner** (`package.json` scripts: only `dev`, `build`, `start`).
All testing is type check + build + manual smoke.

### Type + Build Coverage

| Stage          | Command                                                   | Asserts                                                  |
| -------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| Types          | `npx tsc --noEmit`                                        | New `Lesson` type, `lessonId?` field, picker props compile |
| Build          | `pnpm next build`                                         | All routes including `/api/lessons` build under Next 16  |

### Manual Smoke Checklist

- [ ] `GET /api/lessons` returns 5 seed lessons in JSON
- [ ] `/prep/lesson`: picker renders, default "不关联课节", selecting changes the dot color, save POSTs with `lessonId` field present in body
- [ ] `/prep/lesson`: save without selecting — POST body has no `lessonId` key (or `undefined`)
- [ ] `/use/xuewen/seed-curie`: picker visible left of 结束并保存; pick → save → record arrives at `/records` (existing flow unbroken)
- [ ] `/use/debate/seed-plastic-ban`: same — picker visible, pick → debate → judge → save
- [ ] `/records`: existing list still renders, no regression on `/records/[id]` detail page
- [ ] When `KV_REST_API_*` env vars are unset (dev), in-memory `_mem.byLesson` is populated — verify by adding a temporary `console.log` in `createRecord` (remove before commit)
- [ ] Anti-reference check: no `Inter` / `Roboto` / `Plus Jakarta` fonts shipped; picker uses `font-display`/`font-numeric` only (per `CLAUDE.md` Aesthetic Direction)
- [ ] 1m projector test: pick a lesson on `/use/debate`, step back 1m — can the dot + lesson title still be read at 30cm and 2m?

### Edge Cases Checklist

- [ ] `/api/lessons` 500 → picker silently hides → save flow still works
- [ ] User selects a lesson, then navigates away and back — picker resets to "不关联课节" (intentional, lightweight)
- [ ] Two saves to the same `lessonId` → `kv.sadd` dedupes, second save still 200s
- [ ] `lessonId` passed but lesson does not exist → record still saves (we don't 404 on bad linkage; future view will skip orphans)
- [ ] Save body without `lessonId` → no `kv.sadd` call, no `_mem.byLesson` mutation

---

## Validation Commands

### Level 1: Static Analysis

```bash
npx tsc --noEmit
```

**Expect**: exit 0, no errors.

### Level 2: Unit Tests

N/A — repo has no test runner.

### Level 3: Full Build

```bash
pnpm next build
```

**Expect**: exit 0, all routes compile (look for `/api/lessons`, `/prep/lesson`, `/use/xuewen/[id]`, `/use/debate/[id]` in the build output).

### Level 4: Database Validation

KV is optional in dev (no env vars present in `.env.example` for the demo path).
If `KV_REST_API_URL` and `KV_REST_API_TOKEN` ARE set:

```bash
# After saving with lessonId='l-light-reflection':
curl -H "Authorization: Bearer $KV_REST_API_TOKEN" \
  "$KV_REST_API_URL/smembers/records:byLesson:l-light-reflection"
# Expect: ["r_…","r_…"]
```

### Level 5: Browser Validation

Manual via the smoke checklist above. Open `pnpm dev` → http://localhost:3000.

### Level 6: Manual Validation

The end-to-end teacher flow:

1. Go to `/prep/lesson` (光的反射 page).
2. Send a chat: "出一道3年级简单的反射规律选择题".
3. After response streams, in the Topbar pick "光的反射 · 三年级科学".
4. Click 保存. Expect "已保存：光的反射教案".
5. Go to `/use/xuewen/seed-curie`. Send "什么是镭？".
6. In the Topbar pick the same lesson.
7. Click 结束并保存. Redirect to `/records` after ~700ms.
8. Verify both new records appear in the list (existing UI).
9. (Out of scope) Verify the linkage in KV using Level 4's curl, OR add a one-off `console.log(_mem.byLesson)` to `lib/kv.ts` in dev to inspect.

---

## Acceptance Criteria

- [ ] `Lesson` type added to `lib/types.ts` and exported
- [ ] `lessonId?: string` is a first-class optional field on `BaseRecord`
- [ ] 5 seed lessons exist in `lib/fallback-lessons.ts`
- [ ] `lib/lessons.ts` mirrors `lib/agent-storage.ts` shape (dual-mode + globalThis mem + seed fallback)
- [ ] `GET /api/lessons` returns `{ lessons: [...] }` with the 5 seed lessons (and any KV-stored ones merged in)
- [ ] `POST /api/records` writes `kv.sadd('records:byLesson:{lessonId}', id)` only when `lessonId` is present
- [ ] `LessonPicker` component renders in the Topbar `right` slot of `/prep/*`, `/use/xuewen/[id]`, `/use/debate/[id]`
- [ ] When picker has a selection, the POST body to `/api/records` includes top-level `lessonId`
- [ ] When picker has no selection, the POST body has no `lessonId` (or `undefined`) and no inverse-index write happens
- [ ] No regression on existing save flow — `/records` list and `/records/[id]` detail still render correctly
- [ ] No new external dependency added to `package.json`
- [ ] `npx tsc --noEmit` and `pnpm next build` both pass
- [ ] No fonts from the Typography reject list (`CLAUDE.md` Aesthetic Direction) are introduced

---

## Completion Checklist

- [ ] Tasks 1–9 done in order, each verified before moving on
- [ ] Type-check passes after every task
- [ ] Final `pnpm next build` clean
- [ ] Manual smoke checklist all green
- [ ] Edge-case checklist reviewed
- [ ] No code under `/lessons` route (out of scope)
- [ ] No lesson CRUD UI added (out of scope)
- [ ] Each task committed atomically (the project commit history shows preference for narrowly-scoped commits like `e606611 fix(records): 删除真生效` and `94c2694 refactor(use): 辩论使用页布局重构`)

---

## Risks and Mitigations

| Risk                                                            | Likelihood | Impact | Mitigation                                                                                                                |
| --------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Inverse index drifts from records list when KV writes partial   | LOW        | LOW    | Sad-write happens AFTER record + list writes; failure here leaves a saveable record. Future view defensively skips nulls. |
| Picker UI breaks the topbar layout on narrow widths             | MED        | LOW    | `flex items-center gap-3` plus paper-card neutral styling; the existing topbars already wrap reasonably (verify in dev).   |
| Anti-pattern drift: someone adds Zod to `/api/records` later    | MED        | MED    | Plan explicitly forbids Zod in this scope (NOT Building section); reviewer should reject.                                 |
| Selecting a lesson then refreshing loses selection              | HIGH       | LOW    | Intentional — out of scope to persist selection. UI should not promise persistence.                                       |
| Demo lesson ids leak as KV keys in prod                         | LOW        | LOW    | Slug-style ids (`l-light-reflection`) are intentional; KV namespace `lesson:` is isolated.                                |
| Future grouped-view contributor expects `meta.lessonId` instead | MED        | LOW    | Doc the choice in `lib/types.ts` comment ("first-class field — see `records:byLesson:*` index").                          |

---

## Notes

**Why first-class `lessonId` and not `meta.lessonId`:**

`meta` is `Record<string, string | undefined>` (`lib/types.ts:38`) — fine for free-form
display, terrible for indexing. The route handler reads `body.lessonId` once cleanly;
if it lived in `meta`, every read would be `body.meta?.lessonId` and the typing widens
unnecessarily. The cost (one extra optional field) is trivial.

**Why no Zod migration:**

The records and agents POST routes both validate manually
(`app/api/records/route.ts:30-32`, `app/api/agents/route.ts:27-32`). Adding Zod here
would make this route a snowflake. The `lib/agent-schemas.ts` Zod schemas are reserved
for richer config validation (e.g., `XuewenAgentSchema`); keep that boundary intact.

**Why a native `<select>`:**

CLAUDE.md says "Paper over chrome — fewer shadows/gradients" and lists "Notion/Linear
極简灰白" as anti-references. A custom dropdown invites both mistakes. Native `<select>`
+ paper-card label is the boring-correct choice. A future polish pass can swap in a
custom popover that respects the page-distance test.

**Why no `srem` on delete:**

`deleteRecord` (`lib/kv.ts:52-61`) does not currently know the record's `lessonId` —
adding a get-then-delete round trip costs more than the orphan tolerates. The future
grouped view will dereference each id and skip nulls, which is anyway needed because
record TTL (30 days) outlives the inverse-index Set.

**Naming convention for lesson ids:**

Slug-style ids (`l-light-reflection`) for seed data; runtime-created lessons (out of
scope) would use `l_${Date.now()}_${Math.random().toString(36).slice(2,8)}` — the same
pattern as records/agents (`lib/kv.ts:40`, `lib/agent-storage.ts`).

**Confidence note:**

This plan is intentionally conservative. The riskiest single change is adding a field
to `BaseRecord` — TypeScript widens the `AppRecord` discriminated union automatically,
which the existing `RecordCard` / `RecordReplayPage` components ignore gracefully (they
only branch on `type` and `kind`).
