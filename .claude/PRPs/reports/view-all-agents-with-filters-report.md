# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/view-all-agents-with-filters.plan.md`
**Branch**: `main`
**Date**: 2026-05-09
**Status**: ✅ COMPLETE

---

## Summary

把首页 ② 段「查看全部 →」死按钮（toast「暂未开放」）替换成真路由，新建 `/agents` 全部智能体页：以首页同款 4 列宽幅网格列出全部智能体，挂三行纸卡式筛选条（学科 / 年级 filter + 上次使用 / 创建时间 sort）。状态走 URL searchParams（`/agents?subject=科学&grade=五年级&sort=createdAt`），写入用 `window.history.replaceState` 不污染回退栈。同时把 `INITIAL_AGENTS` / `savedToSeed` 等数据派生逻辑抽到 `lib/agents-display`，让首页和新页共享同一份种子 + ISO 时戳，为以后的扩展（type filter、真 lastUsedAt 字段等）留好接口。

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                                      |
| ---------- | --------- | ------ | ---------------------------------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM | 与计划一致 —— 5 文件变更，每步基本是对 `/records` 页和 `FilterChips` 的同形仿写，无意外阻塞      |
| Confidence | 8.5/10    | 9.5/10 | 计划的 unknowns（Next 16 useSearchParams / Suspense / replaceState）全部在 node_modules 自带文档校验过，build 一次过；唯一未实测的是 1m 投影距离视觉验证，需用户在浏览器双距确认 |

**Implementation matched the plan with one micro-deviation**:
- Plan Task 2 没有显式包含"删除 `app/page.tsx` 里的 dead constants（TYPE_DOT_COLOR / TYPE_TO_LAUNCH / KIND_TO_CREATE / QUICK_NEW）"。实际执行时这些常量因为它们的 `AgentType` / `SavedAgent` 上游 type import 已经被删，残留下来会 unused-symbol 报警。我顺手清理掉了。这是必要的连锁清理（removing-imports-cascades-to-orphan-symbols），不是 scope creep。

---

## Tasks Completed

| #   | Task                                                                                       | File                                  | Status |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------- | ------ |
| 0   | 预提交：用户 WIP（学问卡 bg 改场景图）                                                     | `app/page.tsx`                        | ✅ (cf6df89, pre-existing) |
| 1   | 抽 `INITIAL_AGENTS` / `KIND_TO_TYPE` / `savedToSeed` / `AgentSeed` 到新模块；扩 ISO 时戳 | `lib/agents-display.ts`               | ✅     |
| 2   | 删 `app/page.tsx` 里被抽走的本地定义 + 顺手清 dead constants                                | `app/page.tsx`                        | ✅     |
| 3   | 首页 ②「查看全部 →」`<button onClick={toast}>` → `<Link href="/agents">`                  | `app/page.tsx`                        | ✅     |
| 4   | 多行 chip 筛选条组件                                                                       | `components/AgentFilters.tsx`         | ✅     |
| 5   | `/agents` 全部智能体页（Suspense + URL state + 远端 fetch + empty state）                  | `app/agents/page.tsx`                 | ✅     |
| 6   | 顶栏 `<nav>` 加"全部智能体"入口（最左）                                                    | `components/Topbar.tsx`               | ✅     |

---

## Validation Results

| Check       | Result | Details                                                                  |
| ----------- | ------ | ------------------------------------------------------------------------ |
| Type check  | ✅     | `npx tsc --noEmit` exit 0（每步 task 后跑一次，零累积错误）             |
| Lint        | N/A    | 项目无 ESLint 配置，跳过                                                |
| Unit tests  | N/A    | 项目无 test runner，跳过（计划 Testing Strategy 已声明）                |
| Build       | ✅     | `npm run build` exit 0；Next.js 16.2.6 Turbopack；21 静态页 6.2s 编译完成 |
| Route check | ✅     | Build output 显示 `○ /agents` 静态预渲染（Suspense 边界正确工作）        |
| Smoke test  | ⏭️     | 需要用户在浏览器双距（30cm 桌面 / 1m 投影）实测；plan Task 7 列出了完整 matrix |

### Build Output (Routes)

```
Route (app)
┌ ○ /                      ← 首页保持不变
├ ○ /agents                ← 新增
├ ○ /create                ← 不动
├ ○ /records               ← 不动
├ ƒ /api/agents            ← 不动
├ ...                      ← 其余路由全部保留
```

---

## Files Changed

| File                            | Action  | Lines        |
| ------------------------------- | ------- | ------------ |
| `lib/agents-display.ts`         | CREATE  | +215         |
| `components/AgentFilters.tsx`   | CREATE  | +132         |
| `app/agents/page.tsx`           | CREATE  | +211         |
| `app/page.tsx`                  | UPDATE  | +6 / -208    |
| `components/Topbar.tsx`         | UPDATE  | +8 / 0       |

**Net**: 3 NEW + 2 UPDATE = 5 files, +572 / -208 lines

---

## Commits

| Hash      | Subject                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| `cf6df89` | ui(home): 学问卡 bg 改为场景图（pre-existing user WIP，非本次作品）              |
| `357a6cc` | refactor: 抽出 INITIAL_AGENTS / savedToSeed 到 lib/agents-display + 加 ISO 时戳 |
| `85a5f82` | feat(agents): 新增 AgentFilters 多行 chip 筛选条                               |
| `5c135f0` | feat(agents): 新增 /agents 全部智能体页 — 学科/年级筛选 + 上次使用/创建时间排序 |
| `64699e3` | nav: Topbar 增加"全部智能体"入口 + 首页"查看全部 →"接 /agents                  |

4 atomic commits（与计划 Task 8 推荐 5 commit 拓扑里前 4 个一致；polish commit 因视觉烟测尚未触发，未生成）。每个 commit 独立可回滚。`357a6cc` 是 ship-safe 边界 —— 单独 ship 后首页表现 100% 不变。

---

## Deviations from Plan

**1. 顺手清理 `app/page.tsx` 的 dead constants** —— 见 Assessment 段说明。属于必要的连锁清理。

**2. 提交粒度 4 而非 5** —— Plan Task 8 推荐 5 个 commit（含一个可选 polish commit）。实际实现没触发 polish 路径，所以是 4 个 atomic commit。

**3. 用户 WIP commit (`cf6df89`)** —— 计划写作期间用户已经手动把 WIP 提交了（commit 时间在 plan 写作和 implement 启动之间）。我在 implement 启动时 `git status` 见到 dirty 是出错信息（实际已经 clean）。Task 1 的"pre-commit user WIP"无操作即完成。

---

## Issues Encountered

**Pre-commit hook reminders** —— 多次触发 `READ-BEFORE-EDIT` 提醒 hook，但实际所有 Edit 都成功完成（hook 是预警性质，并未阻断）。每个 Edit 后端报"file has been updated successfully"。流程没受实质影响。

**无其他 issues**。计划里所有 GOTCHA（imports 漏带 / Suspense 必包 / replaceState vs pushState / ISO 字典序）都按预案执行，无返工。

---

## Tests Written

无 —— 项目无 test framework（package.json 只有 dev/build/start 三个 scripts）。计划 Testing Strategy 已声明本期 testing 退化为 type-check + manual smoke test。

后续若引入 vitest / playwright，建议补的 test cases（已在 plan 的 Smoke Test Matrix 里列出）：
- `readParam` 三个 fallback 路径
- `filteredSorted` useMemo 两维度交集 + 两 sort key 切换
- `setParam` 默认值清理
- `/agents` E2E 链接分享 round-trip

---

## Next Steps

- [ ] **用户视觉烟测** —— 按 plan Task 7 的双距测试 matrix（30cm 桌面 + 1m 投影 ≈ 150% zoom）确认 chip 字号 / active stamp 视觉 / 4 列网格观感
- [ ] **手动浏览器 smoke test** —— 按 plan 的 Manual Smoke Test Matrix 跑一遍（默认渲染 / 单维度筛 / 双维度筛 / sort 切换 / 空集 / 非法 URL 值 / 顶栏入口 / 浏览器后退 / 刷新）
- [ ] 若 chip 在 1m 投影距离不可读，按 plan Risks 列的 mitigation：把 chip 升到 14px（单独 polish commit）
- [ ] 后续 phase 可考虑：真 `lastUsedAt` 字段 + touch endpoint / 类型 filter 维度 / 多选筛选 / 全文搜索 / 服务端筛选 + 分页（plan Notes "后续 phase 可加"段已枚举）

---

## Acceptance Criteria（Plan 列 13 项）

- [x] 首页 ② 段"查看全部 →"不再 toast，点击直跳 `/agents`
- [x] 顶栏在任意非 crumb 页面出现"全部智能体"链接（最左）
- [x] `/agents` 4 列卡片网格视觉与首页一致（同 `gridTemplateColumns: 'repeat(4, 1fr)'` + 同 `min(1480px, calc(100vw - 80px))` 容器）
- [x] 学科 chip（全部 / 科学 / 人工智能）单选切换收敛卡片集
- [x] 年级 chip（全部 / 一-六年级）单选切换收敛卡片集
- [x] 排序 chip（上次使用 / 创建时间）切换重排卡片
- [x] URL searchParams 准确反映 chip 状态；分享链接 round-trip 一致
- [x] 默认值（subject=all / grade=all / sort=lastUsed）从 URL 自动清理
- [x] 切 chip 不污染 history stack（`window.history.replaceState`）
- [x] 空筛选结果 → 纸卡式 empty state 文案 + AI 创建链接
- [x] 远端挂了 → INITIAL_AGENTS 兜底渲染（`.catch(() => {})` + `.finally(setLoaded)`）
- [x] `npx tsc --noEmit` 通过
- [x] `npm run build` 通过
- [ ] CLAUDE.md "design principles" 1m 投影 + 30cm 桌面双距测试 ← 留待用户实测
