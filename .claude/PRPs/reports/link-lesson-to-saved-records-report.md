# Implementation Report

**Plan**: `.claude/PRPs/plans/link-lesson-to-saved-records.plan.md`
**Branch**: `main` (committed-on-main project pattern; recent commits e606611/94c2694/38a5784 follow this)
**Date**: 2026-05-08
**Status**: COMPLETE (uncommitted — co-located with the in-flight agent-edit work)

---

## Summary

Saving any record from the prep workflow (PrepToolPage, XuewenUsePage, DebateUsePage)
can now be linked to a course (课程). The linkage is persisted as a first-class
`linkedCourseId?: string` field on `BaseRecord` and an inverse-index Set
`records:byCourse:{courseId}` written by `createRecord`. A small `<CoursePicker>`
component slots into the topbar `right` of all three save flows. The "view records
under a course" UI is intentionally not built, per the task brief.

---

## Assessment vs Reality

| Metric        | Predicted (plan)                                                     | Actual                                                          | Reasoning                                                                                                                        |
| ------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Scope         | New `Lesson` entity + `lessonId` + `lib/lessons.ts` + `/api/lessons` | Reuse existing `Course` + `linkedCourseId` + direct import      | `lib/courses.ts` already exists (with 6 seed courses); the parallel agent-edit plan already adds `linkedCourseId` to all 3 agent schemas. Inventing a parallel `Lesson` would duplicate seed data and split terminology. |
| Tasks         | 9 atomic tasks                                                       | 6 atomic tasks                                                  | No `lib/lessons.ts`, no `lib/fallback-lessons.ts`, no `app/api/lessons/route.ts` — `COURSE_SEEDS` imported client-side directly. |
| Complexity    | MEDIUM                                                               | MEDIUM-LOW                                                      | Smaller because no new KV namespace was needed for the entity (Course is a static seed list).                                    |
| Confidence    | 9/10                                                                 | 10/10                                                           | Type-check + build both green; no new patterns introduced.                                                                       |

**Why the plan deviated:**

I wrote the plan before reading `lib/courses.ts` (created by the parallel
agent-direct-edit-and-course-link plan, untracked at the time). On execution I
detected `COURSE_SEEDS` and the in-flight `linkedCourseId` Zod fields on agent
schemas (lib/agent-schemas.ts diff). The right call was to reuse the existing
data and field name so records and agents speak the same language: both can be
linked to the same `course-science-3-life`-style ids.

---

## Tasks Completed

| # | Task                                                                | File                              | Status |
| - | ------------------------------------------------------------------- | --------------------------------- | ------ |
| 1 | Add `linkedCourseId?: string` to `BaseRecord`                       | `lib/types.ts`                    | ✅     |
| 2 | Write `records:byCourse:{id}` Set in `createRecord` (KV + `_mem`)   | `lib/kv.ts`                       | ✅     |
| 3 | CREATE `<CoursePicker>` (paper-card label + native `<select>`)      | `components/CoursePicker.tsx`     | ✅     |
| 4 | Wire picker into PrepToolPage save                                  | `components/PrepToolPage.tsx`     | ✅     |
| 5 | Wire picker into XuewenUsePage save (defaults to agent's course)    | `components/XuewenUsePage.tsx`    | ✅     |
| 6 | Wire picker into DebateUsePage save (defaults to agent's course)    | `components/DebateUsePage.tsx`    | ✅     |

**Plan tasks dropped (no longer needed):**
- ~~CREATE `lib/fallback-lessons.ts`~~ — `COURSE_SEEDS` already exists in `lib/courses.ts:15-22`
- ~~CREATE `lib/lessons.ts`~~ — Course is a static seed list, no KV CRUD required
- ~~CREATE `app/api/lessons/route.ts`~~ — picker imports `COURSE_SEEDS` directly client-side

---

## Validation Results

| Check       | Result | Details                                                                                                |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Type check  | ✅     | `npx tsc --noEmit` exit 0 (verified after each task)                                                   |
| Lint        | ⏭️     | No lint script in `package.json` (only `dev`/`build`/`start`)                                          |
| Unit tests  | ⏭️     | No test runner configured in this repo; plan explicitly noted N/A under Validation Commands § Level 2 |
| Build       | ✅     | `pnpm next build` clean — all 23 routes compiled, including `/edit/[id]` from in-flight agent-edit work |
| Integration | ⏭️     | Not run; plan-listed manual smoke checklist deferred to user                                          |

Build output excerpt:
```
✓ Compiled successfully in 3.0s
✓ Generating static pages using 7 workers (18/18) in 260ms
```

---

## Files Changed

| File                              | Action | Lines     |
| --------------------------------- | ------ | --------- |
| `lib/types.ts`                    | UPDATE | +1        |
| `lib/kv.ts`                       | UPDATE | +11       |
| `components/PrepToolPage.tsx`     | UPDATE | +9/-1     |
| `components/XuewenUsePage.tsx`    | UPDATE | +22/-16   |
| `components/DebateUsePage.tsx`    | UPDATE | +6        |
| `components/CoursePicker.tsx`     | CREATE | +52       |

Total: **+101 / -17** across 6 files. (One new component, five touch-up edits.)

---

## Deviations from Plan

1. **Renamed entity**: `Lesson` → reuse `Course` from `lib/courses.ts`. Field name `lessonId` → `linkedCourseId`. Inverse index `records:byLesson:*` → `records:byCourse:*`.
   - **Why**: The user's parallel agent-edit plan (`.claude/PRPs/plans/agent-direct-edit-and-course-link.plan.md`) was already in flight, adding `linkedCourseId` to all three agent schemas. Aligning records to the same field name keeps a single coherent vocabulary; both agents and records can now reference the same `course-science-3-life`-style ids.

2. **No `/api/lessons` route**: `<CoursePicker>` imports `COURSE_SEEDS` directly from `@/lib/courses`. `lib/courses.ts` is a pure-data module (no KV imports) so it's safe in a `'use client'` component.
   - **Why**: One fewer API surface; matches the existing client-direct-import pattern for static seed data.

3. **Picker default value**: On `/use/xuewen/[id]` and `/use/debate/[id]`, the picker pre-selects `agent.config.linkedCourseId` if the agent itself is course-linked.
   - **Why**: Friction-saver. If the teacher opened a course-linked agent, the saved record should default to the same course. The picker still allows override or unlinking.

4. **Skipped explicit validation tweak in `app/api/records/route.ts`**: The plan suggested optionally adding a `typeof body.linkedCourseId !== 'string'` guard. Skipped because (a) the existing route does not validate `meta` either and (b) the field type is enforced by the `Omit<AppRecord,…>` body annotation.

---

## Issues Encountered

1. **Stash misadventure during baseline check**: I ran `git stash --include-untracked --keep-index` to inspect the no-pending-changes baseline. This stashed my own in-flight edits and the user's pending agent-edit work. Resolved with `git stash pop` immediately; verified all 4 modified files restored intact via `grep -n "linkedCourseId\|CoursePicker"`. **Lesson**: don't stash to inspect; just type-check and read diffs.

2. **Hook reminders on every edit**: A pre-Edit hook fires a generic READ-BEFORE-EDIT reminder for each Edit call even when the file was read earlier in the session. Edits succeeded regardless ("File ... has been updated successfully") — this is a hook noise issue, not a runtime block.

---

## Tests Written

None. The repository has no test runner (`package.json` scripts: `dev`, `build`, `start` only). The plan's Testing Strategy section documents this and uses tsc + build + manual smoke as the validation path.

If a test framework is added later, the priority cases would be:

| Suite                                         | Cases                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `lib/kv.test.ts` (createRecord branch coverage) | (a) `linkedCourseId` undefined → no `kv.sadd` / no `_mem.byCourse` mutation; (b) `linkedCourseId` present → both index writes happen; (c) duplicate save to same course → `sadd` deduplicates |
| `components/CoursePicker.test.tsx`            | renders all `COURSE_SEEDS`; "不关联课程" first option; `onChange(null)` when reset           |

---

## Next Steps

- [ ] User reviews the diff (5 modified files + 1 new file) and decides whether to commit independently of the agent-edit work or fold them together.
  - Independent commit suggestion (matches recent commit-message style):
    ```
    feat(records): 保存记录关联到课程（picker + linkedCourseId 字段 + records:byCourse 反向索引）
    ```
- [ ] Manual smoke test the three save paths in dev: `/prep/lesson`, `/use/xuewen/seed-curie`, `/use/debate/seed-plastic-ban`. Verify Network tab shows `linkedCourseId` in POST body when the picker is set.
- [ ] When the records-by-course view is eventually built (out of scope for this PR), the read is a single `kv.smembers('records:byCourse:{id}')` — the index is already in place.
- [ ] Consider committing the in-flight `app/edit/`, `EditAgentPage.tsx`, and the agent-storage/schema changes in a separate commit so the two features land cleanly.

---

## Notes

**Why `linkedCourseId` is first-class on `BaseRecord` (not in `meta`):**
`createRecord` reads `record.linkedCourseId` once cleanly to decide whether to write
the inverse index. If it lived in `meta` (`Record<string, string|undefined>`), every
read would widen to `record.meta?.linkedCourseId` and the indexing logic would have
to defensively narrow the type. Trivially worth one extra optional field on the type.

**Inverse index hygiene:** `deleteRecord` (lib/kv.ts:54-61) does NOT remove the record id
from `records:byCourse:{id}` Sets — orphans are tolerable because (a) record TTL is 30
days and (b) any future grouped-view dereferences each id and skips nulls. Adding
`srem` would require a get-then-delete round trip. Out of scope.

**Picker UI choice:** Native `<select>` over a custom popover. CLAUDE.md anti-references
explicitly forbid Notion/Linear-style极简灰白 chrome; a paper-card `<label>` wrapping a
native control matches "paper over chrome" and the editorial tone.

**Coexistence with agent-edit work:** This PR's only data overlap with the in-flight
agent-edit plan is the shared `linkedCourseId` vocabulary. The schemas/storage/route
changes the user is making to agents are entirely separate files and merge cleanly.
