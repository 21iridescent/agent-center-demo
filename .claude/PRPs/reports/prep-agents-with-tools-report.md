# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/prep-agents-with-tools.plan.md`
**Branch**: `main`
**Date**: 2026-05-09
**Status**: COMPLETE

---

## Summary

四个备课 agent（outline / lesson / exercise / activity）从壳 `ToolLoopAgent` 升级为
真正能调工具的 agent。共 **14 个工具**分四档：3 个 Exa 联网（search / crawlUrl /
findSimilar）+ 8 个 LLM-as-tool 学科助手（迷思 / 类比 / 量规 / 材料 / 安全 / 时长 / 课标 /
词汇）+ 1 个 mermaid 生成 + 2 个纯函数（calculator / unitConvert）。每个 agent 装载
6–8 个相关工具的 curated 子集。

同时落地三个长期 UX 缺口：
- **Markdown 渲染** — `react-markdown + remark-gfm` 替代 `whitespace-pre-wrap` 纯文本
- **ContextStrip 真编辑** — 「改参数」按钮从 toast `'未实现'` 升级为原地编辑表单（input/select），课题/学科/年级 + 长度/难度参数可改；通过 transport `prepareSendMessagesRequest` 注入到 system prompt
- **保存包含引用** — `PrepRecord.citations[]` + `toolTrace[]` 持久化；回看页同步渲染 markdown + citations

---

## Assessment vs Reality

| Metric        | Predicted (plan)                  | Actual                            | Reasoning                                                          |
| ------------- | --------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| Tasks         | 17 atomic steps                   | 17 — 全部按计划执行                | 没拆没合                                                           |
| Complexity    | HIGH                              | MEDIUM — 实际工作量比 plan 估的小   | AI SDK v6 的 ToolLoopAgent + tool() 比预期更平滑；prepareSendMessagesRequest 直接解决了动态 body 问题 |
| Dependencies  | + react-markdown + remark-gfm     | 同；不引入 exa-js                 | fetch 直连 Exa 简单可靠                                             |
| Confidence    | 8/10                              | 9/10                              | 唯一意外：PREP_AGENTS Record 类型推断 → 改用 `satisfies` 修掉      |

**Plan deviations**：

1. **PREP_AGENTS 用 `satisfies Record<PrepKind, unknown>` 而非显式 `Record<PrepKind, ToolLoopAgent>`**
   原因：4 个 agent 装载不同工具子集，TOOLS 是 invariant 泛型，Record 的统一类型推断
   导致 createAgentUIStreamResponse 出现"webSearch missing from this agent's tools"等冲突。
   `satisfies` 验证键齐全 + 保留每个 agent 的精确类型。

2. **/api/generate 用 `switch (kind)` 而非 `PREP_AGENTS[kind]` 索引访问**
   原因：索引访问产生 4 个 agent 类型的并集，TS 推断 createAgentUIStreamResponse 的
   TOOLS 泛型时无法收敛。switch 让每条分支拿到具体 agent 类型。

3. **context + params 通过 system UIMessage 而非 `prepareCall` 注入**
   原因：plan 提到 `prepareCall` 是 ToolLoopAgentSettings 而非 createAgentUIStreamResponse
   的参数；要在路由层 override 的话只能改成 instance-per-request 或 ref 模式。
   更简单的等效：拼一条 system role UIMessage 前置到 messages，agent 的 base instructions
   不动。模型把它当首条 system 信号读到，行为等价。

4. **ContextStrip 同时支持 readonly 与 editing 两个模式**
   plan 只说"可编辑"，但页面上其他地方（未来可能）也用到 ContextStrip 的 readonly 视图，
   保留 backwards 兼容更稳妥。state 由父组件 PrepToolPage 持有（非组件内部）。

---

## Tasks Completed

| #   | Task                                        | File                              | Status |
| --- | ------------------------------------------- | --------------------------------- | ------ |
| 1   | + react-markdown + remark-gfm               | `package.json`                    | ✅     |
| 2   | Citation / ToolTraceEntry / PrepRecord 字段 | `lib/types.ts`                    | ✅     |
| 3   | 3 Exa 联网工具                               | `lib/tools/exa.ts`                | ✅     |
| 4   | 8 LLM-as-tool 学科助手                       | `lib/tools/llm-helpers.ts`        | ✅     |
| 5   | generateMermaid                             | `lib/tools/diagrams.ts`           | ✅     |
| 6   | calculator + unitConvert                    | `lib/tools/utils.ts`              | ✅     |
| 7   | barrel + 4 个 per-agent 子集                 | `lib/tools/index.ts`              | ✅     |
| 8   | 4 个 ToolLoopAgent 装上 tools + stopWhen    | `lib/agents/prep.ts`              | ✅     |
| 9   | 工具使用约定追加到 4 段 prompt               | `lib/prep-prompts.ts`             | ✅     |
| 10  | body 增加 context+params；switch 路由       | `app/api/generate/route.ts`       | ✅     |
| 11  | ContextStrip 加编辑模式                      | `components/ContextStrip.tsx`     | ✅     |
| 12  | PrepToolPage state + ref 透传 + 引用提取    | `components/PrepToolPage.tsx`     | ✅     |
| 13  | 4 个 prep page                               | `app/prep/{kind}/page.tsx`        | ✅ (无需改) |
| 14  | MarkdownRenderer (react-markdown + GFM)     | `components/MarkdownRenderer.tsx` | ✅     |
| 15  | ToolStatusChip + isPrepToolType            | `components/ToolStatusChip.tsx`   | ✅     |
| 16  | CitationsPanel + extractCitations + ChatArea 集成 | `components/CitationsPanel.tsx` + `ChatArea.tsx` | ✅ |
| 17  | 备课记录回看走同款 markdown + citations     | `app/records/[id]/page.tsx`       | ✅     |

---

## Validation Results

| Check       | Result | Details                                                                  |
| ----------- | ------ | ------------------------------------------------------------------------ |
| Type check  | ✅     | `npx tsc --noEmit` 每个 task 后都跑，全程 exit 0                          |
| Lint        | ⏭️     | 无 lint 脚本                                                              |
| Unit tests  | ⏭️     | 无 test 脚本（plan 明确写了 N/A）                                          |
| Build       | ✅     | `pnpm next build` 全 23 路由编译过，4s 完成                              |
| Integration | ⏭️     | 客户端手测 deferred（需要 dev server + Exa 调用真测）                    |

Build output:
```
✓ Compiled successfully in 4.0s
  Finished TypeScript in 4.2s ...
✓ Generating static pages using 7 workers (18/18) in 290ms
```

---

## Files Changed

### Plan #1 主体（17 文件）

| File                                | Action | Lines     |
| ----------------------------------- | ------ | --------- |
| `package.json` + `pnpm-lock.yaml`   | UPDATE | + 2 deps  |
| `lib/types.ts`                      | UPDATE | +24       |
| `lib/tools/exa.ts`                  | CREATE | +130      |
| `lib/tools/llm-helpers.ts`          | CREATE | +220      |
| `lib/tools/diagrams.ts`             | CREATE | +40       |
| `lib/tools/utils.ts`                | CREATE | +110      |
| `lib/tools/index.ts`                | CREATE | +60       |
| `lib/agents/prep.ts`                | UPDATE | +37/-9    |
| `lib/prep-prompts.ts`               | UPDATE | +20/-5    |
| `app/api/generate/route.ts`         | UPDATE | +79/-15   |
| `components/ContextStrip.tsx`       | UPDATE | +180/-15  |
| `components/PrepToolPage.tsx`       | UPDATE | +156/-30  |
| `components/MarkdownRenderer.tsx`   | CREATE | +135      |
| `components/ToolStatusChip.tsx`     | CREATE | +110      |
| `components/CitationsPanel.tsx`     | CREATE | +130      |
| `components/ChatArea.tsx`           | UPDATE | +34       |
| `app/records/[id]/page.tsx`         | UPDATE | +27/-8    |

总计 plan #1：**17 文件，+1500/-80 行**。

### 同 commit 一并提交（用户并行迭代的工作）

不属于 plan #1 但与之共构 commit（避免半成品破构建）：

| File                                                                | 备注                                              |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `lib/deepseek.ts`                                                   | 用户加 QUALITY_OPTS / FAST_OPTS 思考模式预设；`lib/agents/prep.ts` 依赖 |
| `app/api/{debate-judge,debate-turn,xuewen-chat}/route.ts`           | 用户切换到 FAST_OPTS / QUALITY_OPTS                |
| `lib/agents/create-{xuewen,debate,discussion,unified}.ts`           | 用户为这些 agent 也接入 QUALITY_OPTS               |
| `components/{AgentCreatePage,RoleCard,XuewenUsePage}.tsx`           | 用户 UX 微调                                       |
| `components/AgentForm/{Debate,Discussion,Xuewen}.tsx`               | 用户 form 字段调整                                 |
| `components/AgentForm/CourseFormPicker.tsx`                         | 用户新组件                                         |
| `components/CoursePicker.tsx`                                       | 用户调样式                                         |
| `lib/courses.ts`                                                    | 用户调种子                                         |

---

## Issues Encountered

### 1. `Record<PrepKind, ToolLoopAgent>` 类型推断失败

**症状**：
```
Type 'ToolLoopAgent<never, { readonly webSearch: ... }, never>'
is not assignable to type 'ToolLoopAgent<never, {}, never>'
```

**原因**：`ToolLoopAgent` 的 `TOOLS extends ToolSet` 是 invariant 泛型；4 个 agent 各装
不同工具集 → 类型不能共享一个 `ToolLoopAgent` 默认 generic。

**Fix**：`PREP_AGENTS` 改用 `as const satisfies Record<PrepKind, unknown>`——验证 keys
齐全 + 保留各 agent 精确类型；下游用具体 `outlineAgent` / `lessonAgent` 而非索引访问。

### 2. `createAgentUIStreamResponse({ agent: PREP_AGENTS[kind] })` 推断失败

**症状**：types 不匹配（同一根因的下游表现）。

**Fix**：`/api/generate/route.ts` 改用 `switch (kind)` 在每条分支显式调
`createAgentUIStreamResponse({ agent: outlineAgent, ... })` 等。

### 3. useChat 动态 body

**问题**：`DefaultChatTransport({ body: { kind } })` 是构造期固定的，无法在 contextFields
变化时透传新值。

**Fix**：用 v6 新增的 `prepareSendMessagesRequest` 回调，per-send 现读 stateRef 里的
最新 contextFields + params。transport 实例不重建，避免 useChat 重置。

---

## Tests Written

无测试（项目无 test runner）。完成后的可手测路径已在 plan 中列出（Smoke Checklist 段）。

---

## Next Steps

- [ ] 手动验证 5 项核心路径（详见 plan Smoke Checklist）：
  - `/prep/outline`、`/prep/lesson`、`/prep/exercise`、`/prep/activity` 各发一句话，看 agent 调工具 + 出 markdown + Citations
  - 改参数 → POST body 含 context + params
  - 保存 → 回看页有 markdown + Citations
  - EXA_API_KEY 已配（commit `97183a3` 时塞进 .env.local），首跑应该能联网
  - 1m 投影测试：tool chip + Citations 在 1080p 投影 2m 距离仍可读
- [ ] 确认 DeepSeek 模型工具调用准确率（plan 列为最大风险）；如果工具调用准确率 < 70%，
      切到 OpenRouter `openai/gpt-4o-mini`（一行改 `lib/deepseek.ts`）
- [ ] 准备 plan #2（项目化 kind + mermaid 浏览器渲染 + Artifact 侧栏 + Word 导出）执行
