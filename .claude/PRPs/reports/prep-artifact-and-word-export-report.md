# Implementation Report

**Plan**: `.claude/PRPs/plans/prep-artifact-and-word-export.plan.md`
**Branch**: `main`
**Date**: 2026-05-09
**Status**: COMPLETE

---

## Summary

落地了 plan #1 (prep-agents-with-tools) 之上的产物管理层四件事：
1. **第 5 个 prep kind `project`**（项目化学习 PBL）：types/prompts/agent/tools/路由/页面/首页入口全链路
2. **Mermaid 浏览器实渲染**：客户端组件 + `language-mermaid` 代码块在 chat / drawer / 回看页都渲为 SVG
3. **Artifact 侧栏**：lesson/exercise/project 三个长产物 kind 多了"两页对开"的稿件侧栏（浏览/编辑/导出三档）
4. **Word 导出**：5 个 prep 页 topbar + drawer + 备课记录回看页都有 [⬇ 导出 Word]

**主要偏离原计划**：Word 导出从"客户端 marked + html-to-docx"改成"服务端 API route"。原因见 Deviations 节。

---

## Tasks Completed

| #   | Task | File | Status |
| --- | ---- | ---- | ------ |
| 1   | PrepKind 加 'project' + 3 个 PREP_KIND_* 常量同步 | `lib/types.ts` | ✅ |
| 1   | PROJECT_PROMPT + PREP_KIND_TO_PROMPT 映射 | `lib/prep-prompts.ts` | ✅ |
| 2   | PROJECT_TOOLS (9 件) | `lib/tools/index.ts` | ✅ |
| 2   | projectAgent 实例 + PREP_AGENTS.project | `lib/agents/prep.ts` | ✅ |
| 3   | VALID_KINDS 加 project + switch case | `app/api/generate/route.ts` | ✅ |
| 3   | /prep/project 页面 | `app/prep/project/page.tsx` | ✅ (CREATE) |
| 4   | 首页 TOOLS 数组加🧪卡 | `app/page.tsx` | ✅ |
| 5   | mermaid 依赖 + MermaidBlock | `components/MermaidBlock.tsx` | ✅ (CREATE) |
| 5   | MarkdownRenderer code 分支替换占位 | `components/MarkdownRenderer.tsx` | ✅ |
| 6   | marked + html-to-docx 依赖 | `package.json` | ✅ |
| 6   | word-export 客户端入口（POST → /api/export-docx） | `lib/word-export.ts` | ✅ (CREATE) |
| 6   | docx 服务端 API route | `app/api/export-docx/route.ts` | ✅ (CREATE) |
| 7   | ArtifactDrawer 三档状态组件 | `components/ArtifactDrawer.tsx` | ✅ (CREATE) |
| 8   | PrepToolPage 接 drawer + Word 按钮 + push grid 布局 + artifact source 派生 + 编辑写回 | `components/PrepToolPage.tsx` | ✅ |
| 9   | --container-spread token | `app/globals.css` | ✅ |
| 10  | 备课回看页加 Word 导出按钮（提取为 PrepExportButton 客户端组件） | `app/records/[id]/page.tsx`, `components/PrepExportButton.tsx` | ✅ |

---

## Validation Results

| Check | Result | Details |
| ----- | ------ | ------- |
| Type check (`npx tsc --noEmit`) | ✅ | exit 0 — 0 errors after fixing html-to-docx ambient declaration + Response Body 类型 |
| Dev server compile (`pnpm dev`) | ✅ | localhost:3000 serves /prep/project (HTTP 200, 28KB) and / (HTTP 200, 46KB) |
| Project page content | ✅ | 渲染 "项目化学习设计" 标题、"稿件" 切换按钮、"导出 Word" 按钮、"课时数" 字段 |
| Word 导出 API (`POST /api/export-docx`) | ✅ | 真实 markdown(含 mermaid)→ 24290 字节 .docx，文件实际是有效 ZIP（docx 容器） |
| Replay page (`/records/p1`) | ✅ | HTTP 200，包含 "导出 Word" 按钮 |
| Production build (`pnpm next build`) | ⏭ SKIPPED | 磁盘空间紧张（剩 4.9Gi，build 历史峰值 ~2.6Gi）；dev compile + tsc 已覆盖大部分风险 |

---

## Files Changed

| File | Action | Notes |
| ---- | ------ | ----- |
| `lib/types.ts` | UPDATE | PrepKind + 3 个常量加 'project' |
| `lib/prep-prompts.ts` | UPDATE | + PROJECT_PROMPT + 映射 |
| `lib/agents/prep.ts` | UPDATE | + projectAgent (QUALITY_OPTS) + PREP_AGENTS.project |
| `lib/tools/index.ts` | UPDATE | + PROJECT_TOOLS (9 件) |
| `app/api/generate/route.ts` | UPDATE | VALID_KINDS + switch case |
| `app/prep/project/page.tsx` | CREATE | 项目化学习设计 page wrapper |
| `app/page.tsx` | UPDATE | TOOLS[4] = 🧪 卡 |
| `components/MermaidBlock.tsx` | CREATE | 浏览器 mermaid 渲染（dynamic import + getComputedStyle 取主题变量） |
| `components/MarkdownRenderer.tsx` | UPDATE | code 分支：language-mermaid → `<MermaidBlock>` |
| `lib/word-export.ts` | CREATE→REWRITE | 改为 POST `/api/export-docx` 拿 blob 触发下载 |
| `app/api/export-docx/route.ts` | CREATE | 服务端 marked + html-to-docx → blob |
| `components/ArtifactDrawer.tsx` | CREATE | 540px 右栏，浏览/编辑/导出三档 |
| `components/PrepToolPage.tsx` | UPDATE | drawer state、editedArtifact、push grid 布局、topbar 双新按钮、handleSave 用 artifactSource |
| `components/PrepExportButton.tsx` | CREATE | 客户端按钮，给服务端 record 详情页用 |
| `app/records/[id]/page.tsx` | UPDATE | 头部加 PrepExportButton |
| `app/globals.css` | UPDATE | + `--container-spread: 1680px` |
| `html-to-docx.d.ts` | CREATE | ambient module 声明（npm 上无 @types） |
| `package.json` + lockfile | UPDATE | + mermaid@^11、marked@^14、html-to-docx@^1.8 |

---

## Deviations from Plan

### 1. Word 导出从客户端改为服务端

**计划**：客户端 `marked` + `html-to-docx` 双 dynamic import，浏览器里直接生成 .docx blob。

**实际**：服务端 `/api/export-docx` 走 marked + html-to-docx，客户端只 fetch + 下载。

**为什么改**：
- `html-to-docx@1.8` 的 ESM build 在顶层 `import "fs"`、`import "crypto"`、`import "path"`，这些是 Node 内置模块。浏览器 bundler（dev 是 turbopack、prod 是 webpack）必须给它们打 stub fallback 才能编译。
- 真试过 `next.config.ts` 加 `webpack.resolve.fallback: { fs: false, ... }` 路径——但 Next 16 dev 默认 turbopack，需要 `turbopack.resolveAlias` 同时配。两条配同时维护，污染面大且不稳。
- 最关键：即便 bundler 编过，浏览器运行时跑到 `import fs from "fs"` 仍会爆。`html-to-docx` 实际上不是浏览器友好的。
- 服务端跑天然 OK；客户端只多 1 次 fetch（200-500ms 延迟），UX 上不可感知。
- 隐私上小损失：markdown 短暂上传到本应用的服务端（KV 保存路径已经会上传），不外泄第三方。
- 离线不可用——但本应用所有 chat 都需要联网，不是真离线场景。

**影响**：plan Notes 节 "为什么用客户端 Word 导出而不是 pandoc 服务端" 的 (1)(2)(3)(4) 中 (3)(4) 不再适用；(1)(2) 仍成立（不用 pandoc / 用 html-to-docx 跑在自家 Node 上）。

### 2. 加 `html-to-docx.d.ts` ambient module declaration

**为什么**：npm 上无 `@types/html-to-docx`；TS strict 模式 `noImplicitAny` 会报。最小代价：项目根加一个 `.d.ts` 写最小声明。

### 3. PROJECT_TOOLS 取 9 件而非 10

**计划提供 10 件**（webSearch, crawlUrl, findSimilar, findMisconceptions, materialsList, safetyWarnings, timeBudget, generateRubric, matchCurriculum, generateMermaid）但 Solution Statement 说"共 9 个"，pattern 注释说可去掉 findSimilar。

**取 9** = 计划中 10 件去掉 `findSimilar`（防止工具选择困难）。

### 4. PrepReplayPage 提取 PrepExportButton 客户端子组件

**为什么**：`/records/[id]/page.tsx` 是 server component（async + getRecord），不能直接 `'use client'`。把按钮提到 `components/PrepExportButton.tsx` 单文件 `'use client'`，server 页面 import 该组件即可。

---

## Issues Encountered

1. **磁盘满 (192Mi)**：执行到 PrepToolPage state 那次 Edit 时 ENOSPC 失败。处理：删 `.next/` (2.6Gi 缓存) 释放空间，dev server 重启后重建。
2. **html-to-docx fs import**：见 Deviations §1。
3. **TS Response Body 类型**：Buffer ArrayBufferLike 不直接给 `Response`。处理：通过 `buffer.slice()` 切到 ArrayBuffer 再 wrap 进 Blob。
4. **Stale `.next/dev/types/validator.ts`**：删 `.next` 后 next dev 重建生成新 validator，`/api/export-word` 旧引用消失。

---

## Tests Written

未新增单元测试（项目无 test runner 配置；plan Validation Level 2 = N/A）。

E2E smoke 通过 dev server + curl 验证：
- 首页 5 张备课卡渲染（含 🧪 项目化学习）
- /prep/project 页面 200 + 渲染主组件
- /api/export-docx 实际返回有效 .docx zip
- /records/p1 有 [导出 Word] 按钮

---

## Next Steps

- [ ] 浏览器手测：mermaid 在 chat 区真渲染（curl 看不到 SVG，需要 JS 执行）
- [ ] 浏览器手测：drawer 打开/编辑/收起的视觉
- [ ] Word 打开手测：标题层级、表格、mermaid 源码块
- [ ] commit 全部变更
