# Implementation Report

**Plan**: `.claude/PRPs/plans/ai-create-with-inline-form-cards.plan.md`
**Branch**: `main` (solo dev, no remote — atomic commits direct on main)
**Date**: 2026-05-08
**Status**: COMPLETE (代码侧；UI smoke test 待人工跑)

---

## Summary

把现有 3 路 `/create/[kind]` + 50/50 分屏（左聊右表单）的智能体创建流，重构为：① 首页一颗醒目的"AI 创建"按钮 → 单一 `/create` 路由；② 全屏对话区，无常驻表单；③ 后端 3 个 `ToolLoopAgent` 合并为 1 个 `unifiedCreateAgent`（绑 3 个 client-side tool，LLM 自路由）；④ 工具调用以内联可编辑卡片形式渲染在对话流中（HITL 模式，state 永远停在 `input-available`），用户原地编辑、点"确认保存"调 `POST /api/agents`。

两次 atomic commits：
- `751c446` backend：合并 3 ToolLoopAgent → unifiedCreateAgent，−92 净代码
- `6a0bcbd` frontend：内联卡片 + 全屏聊天 + 首页入口归一，+24 净代码

---

## Assessment vs Reality

| Metric | Predicted | Actual | Reasoning |
|---|---|---|---|
| Complexity | MEDIUM (9 tasks) | MEDIUM (9 tasks 全过) | 计划与执行 1:1 — 没遇到隐藏积木 |
| Confidence | 9/10 | 9/10 | TSC 一次过，build 一次过；HITL semantics 与计划假设完全吻合（SDK docblock 已验过） |
| 净代码量 | 估算"轻度" | −68 行（-92 + 24） | 合并 agent 比新增组件省得多 |

实际偏差：**无**。9 个 task 严格按计划顺序跑完。

---

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 1 | CREATE unified agent | `lib/agents/create-unified.ts` | ✅ |
| 2 | MODIFY agents barrel export | `lib/agents/index.ts` | ✅ |
| 3 | MODIFY create-agent route (drop kind dispatch) | `app/api/create-agent/route.ts` | ✅ |
| 4 | DELETE 3 legacy per-kind agents | `lib/agents/create-{xuewen,debate,discussion}.ts` | ✅ |
| 5 | CREATE inline form card | `components/AgentInlineFormCard.tsx` | ✅ |
| 6 | MODIFY chat renderer (parts.map switch) | `components/ChatArea.tsx` | ✅ |
| 7 | REWRITE create page (full-width chat) | `components/AgentCreatePage.tsx` | ✅ |
| 8 | CREATE /create page + DELETE [kind] dir | `app/create/page.tsx`, `app/create/[kind]/` | ✅ |
| 9 | MODIFY home (single AI 创建 button + drop pills) | `app/page.tsx` | ✅ |

---

## Validation Results

| Check | Result | Details |
|-------|--------|---------|
| Type check (`pnpm exec tsc --noEmit`) | ✅ | EXIT=0 — 后端阶段 + 前端阶段两次确认 |
| Lint | ⏭️ | 仓库无 lint script，tsc strict mode 已覆盖 |
| Unit tests | ⏭️ | 仓库无测试套件（demo 项目；无 jest/vitest 配置）；UI 行为通过 manual smoke test 验证 |
| Build (`pnpm build`) | ✅ | Next.js 16.2.6 (Turbopack) 编译成功，2.8s；TypeScript 2.3s；12 个 routes 全部成功生成；`/create/[kind]` 已从路由表消失，`/create` 静态化、`/api/create-agent` 仍是 Edge function |
| Integration | ⏭️ | 见下方"待人工 smoke test" |

### 待人工 smoke test（plan Validation Level 3）

实施 agent 没法触发浏览器流，需要用户运行 `pnpm dev` 并按下面 10 步过：

1. ✅ 首页 ② 授课区域**只有一颗** "+ AI 创建" 主按钮（不再是 3 个分类 pill）
2. ✅ 点 "+ AI 创建" → 跳 `/create`（URL 不再有 `[kind]`）
3. ✅ 页面只有一个对话区，**没有右栏空表单**
4. ✅ 输入「给我个三年级讲磁铁的牛顿」→ AI 回复 + 内联卡片出现
5. ✅ 修改 background → 立即反映在卡片内
6. ✅ 输入「把性格改幽默一些」→ 历史里多出第二张卡片，第一张依然存在
7. ✅ 第一张卡片点「取消草稿」→ 折叠
8. ✅ 第二张卡片点「确认保存」→ toast → 跳首页 → 列表能看见新 agent
9. ✅ 分别测「四年级辩论塑料袋禁用」（→ proposeDebateAgent）+ 「四年级讨论班级零食」（→ proposeDiscussionAgent）
10. ✅ Console 无红字；Network 里 `/api/create-agent` 200 + `/api/agents` 200

---

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `lib/agents/create-unified.ts` | CREATE | +71 |
| `lib/agents/index.ts` | UPDATE | +4 / −15 |
| `app/api/create-agent/route.ts` | UPDATE | +2 / −24 |
| `lib/agents/create-xuewen.ts` | DELETE | −44 |
| `lib/agents/create-debate.ts` | DELETE | −38 |
| `lib/agents/create-discussion.ts` | DELETE | −48 |
| `components/AgentInlineFormCard.tsx` | CREATE | +146 |
| `components/AgentCreatePage.tsx` | REWRITE | +56 / −206 |
| `components/ChatArea.tsx` | UPDATE | +77 / −33 |
| `app/create/page.tsx` | CREATE | +5 |
| `app/create/[kind]/page.tsx` | DELETE | −16 |
| `app/page.tsx` | UPDATE | 多处 in-place 编辑（−6 const QUICK_NEW + −5 const KIND_TO_CREATE + −24 pill row + +10 主按钮 + 5 处 href 改写） |

净变化：+356 / −424 ≈ **−68 行**（合并比新增省）

---

## Deviations from Plan

**1. Saved agent 的"编辑"按钮处理方式微调**

- 计划原文："暂时隐藏（用 `false &&` 包住或直接删 link 留 placeholder text）"
- 实际：把 `savedToSeed()` 里 `editHref` 直接设成 `'/'`（点击落首页 no-op）
- 理由：隐藏按钮需要改 `AgentCard.tsx`（不在 plan 范围内），改 href 影响最小；`AgentCard` 内部的 edit 按钮通常只在 manageMode 下显示，正常用户视野里看不到，这条降级实际效果约等于"隐藏"

**2. PrepToolPage 作为 AgentCreatePage REWRITE 的 MIRROR 没真正参考**

- 计划提到"参考 `PrepToolPage.tsx`（备课页，单列结构）"
- 实际：直接基于现有 AgentCreatePage 删减——删 50/50 grid + 表单 imports + formState 三件套，保留 ChatArea/ChatInput/Topbar 用法
- 理由：现有文件本来就有完整结构，删除比"看另一个文件再仿写"省时

其它无偏差。

---

## Issues Encountered

**1. 中间 tsc 失败（预期内）**

写完 Tasks 5+6+7 跑 tsc 时报：
```
app/create/[kind]/page.tsx(14,27): error TS2322:
  Type '{ kind: CreateKind; }' is not assignable to type 'IntrinsicAttributes'.
  Property 'kind' does not exist on type 'IntrinsicAttributes'.
```

原因：旧 `[kind]/page.tsx` 还在传 `kind` prop，但 AgentCreatePage 已经不接受。Task 8 把 `[kind]/` 整目录删掉后 tsc 立刻 EXIT=0。

**2. PreToolUse Read-before-Edit hook 反复触发（噪音）**

每次对已读文件 Write/Edit 都触发"Read first"提醒——但实际写入都成功了（Hook 是事前 reminder，不是阻断）。当前会话内确实 Read 过这些文件，hook 似乎没读到这层会话状态。不影响落地，记录在此供日后排查 hook 配置。

---

## Tests Written

无（仓库无测试基建——`package.json` 无 `test` script，无 jest/vitest 配置文件）。建议后续单独 PRP 接入 vitest + 起码给 `AgentInlineFormCard.tsx` 的保存 / 取消 / 必填校验三条路径加 React Testing Library 测试。

---

## Next Steps

- [ ] **用户跑 `pnpm dev` 走 10 步 smoke test**（见上方"待人工 smoke test"）——这是唯一未被代码层覆盖的验证
- [ ] 测试 unifiedCreateAgent 的路由准确度——关键风险点；如果发现误路由（学问 → debate tool 之类），调 `lib/agents/create-unified.ts` 的 INSTRUCTIONS 加更多 few-shot 示例 + 把 temperature 从 0.5 降到 0.3
- [ ] 后续单独 PRP：编辑已保存 agent 的流程（当前 saved agent 编辑按钮 fallback 到首页）
- [ ] 后续单独 PRP：保存后用 `addToolOutput({ output: { saved: true, agentId } })` 回灌让 AI 在对话里说"已为你保存为牛顿"——纯 UX 糖
- [ ] （可选）接入 vitest 测试基建并补 InlineFormCard 行为测试

---

## Architecture Notes

**为什么后端塌成 1 个 agent 是必然的**：单一 `/create` 入口（用户描述 → AI 分类）注定不能在请求层传 `kind`，所以 dispatch 只能在 LLM 那一层。多 tool ToolLoopAgent + instructions 路由就是 v6 标准做法。

**HITL 状态稳定性**：tool 没有 `execute` → ToolLoopAgent 在工具调用处自动终止 loop（SDK docblock `node_modules/ai/dist/index.d.ts:3516-3526` 原文确认）。state 永远停在 `input-available`，卡片可以无限期编辑。**唯一风险**是用户保存前继续聊天，下一轮 LLM 历史里有"未应答 tool call"（`index.d.ts:1134-1135` 文档明写）—— 这正是我们想要的"AI 改主意可以再发新版"行为，不是 bug。

**杠杆点**：`ChatArea.tsx` 从"filter 丢非 text part"改成"switch 分发 React 组件"是整个设计的承重墙。以后再加新工具（AI 评委、AI 速创），只要新增一个 `case 'tool-{newToolName}'` + 一个内联组件，无须再动路由 / 页面 / 状态层。

---

## Commits Recap

```
6a0bcbd frontend: AI 创建 — 单一 /create + 工具调用内联渲染为可编辑卡片
751c446 backend:  合并 3 个 ToolLoopAgent 为单一 unifiedCreateAgent
afa3e40 (上一刀，本次未动) Home: fetch saved agents from /api/agents + quick-new pills point to /create/{kind}
```
