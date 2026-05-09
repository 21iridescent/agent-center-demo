# Feature: 项目化学习 kind + Mermaid 实渲染 + Artifact 侧栏 + Word 导出

## Summary

承接 `prep-agents-with-tools.plan.md` 的工具基础设施，在它落地之后再叠四件事：
**(1)** 把第 5 个 prep kind `project`（项目化学习 PBL）加进备课工具集
（既不替代 `activity` 单课时活动，也不挤压 `lesson` 教案）；
**(2)** Mermaid 代码块从占位 `<pre>` 升级为浏览器端真渲染（动态 import `mermaid` lib，paper 主题）；
**(3)** 给 `lesson` / `exercise` / `project` 三个长产物 kind 加 **Artifact 侧栏**——
chat 在左、稿件在右，可编辑、可保存、可导出；
**(4)** 所有 5 个 kind 都加 **「⬇ 导出 Word」** 按钮——markdown → HTML → .docx → 浏览器下载。

整套之后，老师的工作流是：在 chat 里反复跟 agent 调；右栏看着稿件成型；点编辑直接改 markdown；
点"导出 Word"拿到能在 Word 里继续编辑的 .docx，不用再复制粘贴。

## User Story

作为一名要把 AI 生成的教案/项目方案直接交给学生家长或备课组的小学教师
我希望生成的稿件能在右栏单独打开（不被 chat 滚走）、能就地修改、能下载成 Word 文档
并且当我做"项目化学习"这种跨多课时方案时有专门的智能体能用
这样我的 AI 备课流程从「生成 → 复制 → 粘贴 → 排版」缩短为「生成 → 调整 → 下载」。

## Problem Statement

承接 plan #1 的渲染管道，但这些问题没解决：

1. **没有第 5 个 kind**：`PrepKind = 'outline' | 'lesson' | 'exercise' | 'activity'`
   （`lib/types.ts:3`）。项目化学习（PBL）跟单课时活动结构上不一样——多课时、阶段性产出、
   驱动性问题、跨学科——硬塞进 `activity` 会污染 prompt。需要单独 kind + prompt。

2. **Mermaid 是占位**：plan #1 里 `MarkdownRenderer` 对 `language-mermaid` 代码块只渲灰底
   占位（"[mermaid 图表 — 浏览器渲染待 P2]"）。教师拿到的教案有 mermaid 源码但没图，
   还得自己复制到 mermaid.live。

3. **Chat 是单栏**：所有 prep 页都是 `--container-form` 一栏（`PrepToolPage.tsx:131`）。
   长教案 / 长项目方案在 chat 里上下滚动，老师看一段忘一段；而且改一个字要让 agent 重生成
   整段，没法精修。

4. **拿不下来**：保存后能在 `/records/[id]` 回看，但仍是网页里渲染。要交给备课组就得复制
   markdown 到 Word，标题层级丢失。**没有"导出"动作**。

## Solution Statement

四件事按 plan 顺序叠加，复用 plan #1 的 `MarkdownRenderer` / `ToolStatusChip` / `CitationsPanel`
作为底座：

- **`project` kind 全链路**：`PrepKind` 联合加成员；新 `PROJECT_PROMPT`
  （重点：驱动性问题 / 阶段拆分 / 跨课时时间表 / 评价量规 / 跨学科衔接）；新 `projectAgent`
  装 `PROJECT_TOOLS`（共 9 个：plan #1 全部联网工具 + materials_list + safety_warnings +
  time_budget + generate_rubric + match_curriculum + generate_mermaid——是工具最重的 agent）；
  新 `app/prep/project/page.tsx`；首页 `TOOLS` 数组加一项。

- **Mermaid 实渲染**：装 `mermaid` lib，新 `<MermaidBlock>` 客户端组件，dynamic import +
  useEffect 渲染，paper 主题 + 错误兜底为源码。修 `MarkdownRenderer` 的 `code` 组件分支。

- **Artifact 侧栏**：新 `<ArtifactDrawer>`——固定右栏 540px、push 布局让 chat 同步收窄而非
  覆盖（"两页对开"的纸感）。Topbar 加 `[📄 稿件]` 切换按钮，仅 `lesson|exercise|project`
  显示。Drawer 状态有三档：浏览（markdown render）/ 编辑（textarea）/ 导出中。
  artifact 来源是 last assistant message text；用户编辑后写回内部 state，保存时进
  `PrepRecord.content`。

- **Word 导出**：装 `marked`（35KB）+ `html-to-docx`（150KB），都 dynamic import。
  新 `lib/word-export.ts` 接受 markdown + 文件名，返回触发下载的 Promise。
  Topbar 加 `[⬇ 导出 Word]` 按钮（5 个 kind 都有，只要有 last assistant text 即启用）；
  Drawer 内也复用同一按钮。

## Metadata

| Field            | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Type             | ENHANCEMENT（plan #1 之上的产物管理层）                                                     |
| Complexity       | MEDIUM（10 任务；多文件但每件改动局部）                                                     |
| Systems Affected | prep kind 元数据 / agents / 路由 / 4 处 prep 页（含新增 1 个）/ MarkdownRenderer / 首页 / 保存 + 回看 / 类型 / 新增 3 个组件 |
| Dependencies     | `mermaid@^11`、`marked@^14`、`html-to-docx@^1.8`（NEW）+ plan #1 的产物（`MarkdownRenderer` 等） |
| Estimated Tasks  | 10                                                                                          |
| Prerequisite     | **plan #1（prep-agents-with-tools）必须先实施完毕** — 本 plan 直接 import 它新建的组件      |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  状态：plan #1 已实施完毕                                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  /prep/lesson  ─────  [ 课程▾ ][ 保存到记录 ]                                  ║
║  ┌──────────────────────────────────────────────────────┐                     ║
║  │ chat（单栏，--container-form 宽）                       │                     ║
║  │  AI │ # 光的反射教案                                     │                     ║
║  │     │ 🔍 搜索 ✓  📚 对课标 ✓                              │                     ║
║  │     │ ## 教学目标                                          │                     ║
║  │     │ ## 板书设计                                          │                     ║
║  │     │ ```mermaid                                          │                     ║
║  │     │ graph LR; 光源-->镜面-->反射光                      │                     ║
║  │     │ ```  ← 显示「[mermaid 图表 — 浏览器渲染待 P2]」 ❌    │                     ║
║  │     │ ## 评价量表  (table 渲染 ✓)                          │                     ║
║  │     │ ┌ Citations · 3 条 ────────────────┐               │                     ║
║  │     │ └────────────────────────────────┘                │                     ║
║  └──────────────────────────────────────────────────────┘                     ║
║                                                                               ║
║  没有「项目化学习」工具入口（PrepKind 只 4 种）                                 ║
║  没有右栏稿件视图：教案被 chat 上下滚走                                         ║
║  没有 Word 导出：拿到的 markdown 要手动复制到 Word                             ║
║                                                                               ║
║  PAIN: mermaid 是死的；找一段要改先翻 chat；交给备课组要重排版                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  /prep/project  ─  [ 课程▾ ][ ⬇ 导出 Word ][ 📄 稿件 ][ 保存到记录 ]             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  ┌────────────────chat (push, 收窄)──────────────┐ ┌──ArtifactDrawer──┐      ║
║  │ AI │ 「驱动性问题」「3 周阶段」「跨学科衔接」… │ │  📝 / 📄 / ⬇       │      ║
║  │     │ 🔍 搜索 ✓ 📚 对课标 ✓                   │ │  ┌─────────────┐│      ║
║  │     │ # 校园塑料消减项目                        │ │  │ # 校园塑料… ││      ║
║  │     │ ## 驱动性问题                            │ │  │ ## 阶段     ││      ║
║  │     │ ## 阶段 1 调研 (2 课时)                   │ │  │ ## 评价量规 ││      ║
║  │     │ ┌flowchart LR───────────┐                │ │  │ ┌flowchart─┐││      ║
║  │     │ │ 调研→设计→实施→反思    │ ← real SVG ✓ │ │  │ │ 调研→设计 │││      ║
║  │     │ └────────────────────┘                │ │  │ └─────────┘││      ║
║  │     │ ## 评价量规 (table)                     │ │  │ …         ││      ║
║  │     │ ┌ Citations · 5 条 ───┐                │ │  └────────────┘│      ║
║  │     │ └─────────────────┘                  │ │  [ 📝 编辑 ][⬇导出]│      ║
║  └─────────────────────────────────────────────┘ └────────────────┘      ║
║                                                                               ║
║  click [📝 编辑] → 上一栏切 textarea，老师改 markdown 源码                       ║
║  click [⬇ 导出 Word] → marked → html-to-docx → 下载「校园塑料消减项目方案.docx」║
║  click [📄 稿件] 切换 drawer 显隐（默认开 lesson/exercise/project，关 outline/activity）║
║                                                                               ║
║  USER_FLOW: 设参数 → 一句话 → agent 出稿 → 右栏看 → 改 → 导出/保存            ║
║  VALUE_ADD: 项目化 kind / mermaid 真图 / 编辑稿件 / 一键 Word                  ║
║  DATA_FLOW: artifact = 最新 assistant text；编辑后存 PrepToolPage state；      ║
║             保存 → record.content；导出 → 客户端 marked + html-to-docx → blob ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                       | Before                                  | After                                                                                       | User Impact                                                                |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 首页 `TOOLS` 数组              | 4 张卡：教学设计/出题/活动/大纲          | + 1 张「项目化学习设计」卡，icon 🧪，路径 `/prep/project`                                     | 老师能从首页直接进 PBL 工具                                                |
| `PrepKind` 联合                | 4 个                                     | 5 个（加 `'project'`）                                                                       | 类型层支持新分支；4 处 PREP_KIND_* 常量同步                                |
| `MarkdownRenderer` `code`      | `language-mermaid` 渲灰底占位 pre        | 渲 `<MermaidBlock source={...}/>`：dynamic import `mermaid` → `mermaid.render` → SVG          | 教案/项目方案里的流程图直接看到，1m 投影也清晰                              |
| Topbar (5 个 prep 页)          | `[课程▾][保存]`                          | `[课程▾][⬇ 导出 Word][📄 稿件 (条件性)][保存]`                                                | 单栏页（outline/activity）只多一个 Word 按钮；3 栏页（lesson/exercise/project）多 2 个 |
| 主区布局                       | 单栏 `var(--container-form)` 居中       | drawer 关：单栏不变；drawer 开：grid `[1fr 540px]`，chat 收窄                                  | "两页对开"的纸感；不破现有居中                                              |
| ArtifactDrawer                 | 不存在                                   | 右栏：稿件 markdown 渲染 / 编辑 textarea 切换 / Word 导出 / 与 topbar 状态联动                  | 老师能在 chat + 稿件之间分屏，无需滚动找上下文                              |
| 保存路径                       | `record.content = lastAssistantText`    | `record.content = artifactSource`（== last assistant text 或用户编辑后的版本）              | 保存的是老师"看到的稿件"，不是 chat 原文                                    |
| `/records/[id]` 备课回看页     | 渲染 `record.content` (markdown)        | + 顶部 `[⬇ 导出 Word]` 按钮；mermaid 自动真渲染                                              | 旧记录回看也能拿到 .docx                                                   |

---

## Mandatory Reading

| Priority | File                                              | Lines        | Why                                                                                          |
| -------- | ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| P0       | `lib/types.ts`                                    | 1-95         | `PrepKind` + 3 个 `PREP_KIND_*` 常量都要加 `project` 成员                                    |
| P0       | `lib/agents/prep.ts` (post-plan-#1)               | all          | 加 `projectAgent`，与 `PROJECT_TOOLS` 对齐；mirror 现有 4 个 agent 实例化模式                |
| P0       | `lib/tools/index.ts` (post-plan-#1)               | all          | 加 `PROJECT_TOOLS = { ... 9 件 }`；mirror `LESSON_TOOLS`/`ACTIVITY_TOOLS` 现有模式          |
| P0       | `lib/prep-prompts.ts` (post-plan-#1)              | all          | 加 `PROJECT_PROMPT` + `PREP_KIND_TO_PROMPT.project`                                          |
| P0       | `components/MarkdownRenderer.tsx` (from plan #1)  | all          | 在 `code` 组件 detect language-mermaid 分支替换占位为 `<MermaidBlock>`                       |
| P0       | `components/PrepToolPage.tsx` (post-plan-#1)      | all          | drawer 状态 + 布局切换 + Word 导出按钮 + artifact source 派生                                |
| P0       | `app/page.tsx`                                    | 30-59        | `TOOLS` 数组加 1 项 (project)                                                                |
| P0       | `app/api/generate/route.ts` (post-plan-#1)        | all          | `VALID_KINDS` 加 `'project'`                                                                 |
| P1       | `components/ContextStrip.tsx` (post-plan-#1)      | all          | 新 prep kind 不需改它；只是确认 contextFields 默认值传得过去                                 |
| P1       | `app/prep/{outline,lesson,exercise,activity}/page.tsx` | all     | 模板：写 `app/prep/project/page.tsx` 时 mirror                                               |
| P1       | `app/records/[id]/page.tsx` 或 `PrepReplayPage`    | all          | 回看页加 Word 导出按钮                                                                        |
| P2       | mermaid v11 docs `.initialize` + `.render`         | section      | `mermaid.render(id, code)` 返回 `{ svg }`；`startOnLoad: false` 避免 SSR 触发                 |
| P2       | `html-to-docx` README                              | quick start  | `htmlDocx.asBlob(html)` 返 Blob；可加 options（页边距、字体）                                 |

**External Documentation:**

| Source                                                  | Section                              | Why                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Mermaid v11 (https://mermaid.js.org/config/usage.html)  | "API Calls — render"                 | render 是 async + 返回 svg 字符串；也提到 themeVariables 自定义；仅浏览器，不能 SSR                                                  |
| marked v14 (https://marked.js.org)                      | quick reference                      | `marked.parse(md)` 同步返 HTML；GFM 默认开启；output 是 HTML string，喂 html-to-docx                                                  |
| html-to-docx (https://github.com/privateOmega/html-to-docx) | usage                            | `import HTMLtoDOCX from 'html-to-docx'; const blob = await HTMLtoDOCX(html, null, options)`；options 可设页边距 / 字体 / 排版         |

---

## Patterns to Mirror

**NEW_PREP_KIND_METADATA**:

```typescript
// SOURCE: lib/types.ts (post-plan-#1)
// COPY THIS PATTERN — only add `project` to each Record<PrepKind, string>:

export type PrepKind = 'outline' | 'lesson' | 'exercise' | 'activity' | 'project';

export const PREP_KIND_LABEL: { [K in PrepKind]: string } = {
  outline:  '课件大纲',
  lesson:   '教案',
  exercise: '习题',
  activity: '课堂活动',
  project:  '项目化学习',                // NEW
};

export const PREP_KIND_TITLE_SUFFIX: { [K in PrepKind]: string } = {
  outline:  '课件大纲',
  lesson:   '教案',
  exercise: '练习题',
  activity: '课堂活动方案',
  project:  '项目化学习方案',            // NEW
};

export const PREP_KIND_TO_PATH: { [K in PrepKind]: string } = {
  outline:  '/prep/outline',
  lesson:   '/prep/lesson',
  exercise: '/prep/exercise',
  activity: '/prep/activity',
  project:  '/prep/project',             // NEW
};
```

**PROJECT_PROMPT** (新加进 `lib/prep-prompts.ts`):

```typescript
export const PROJECT_PROMPT = `你是「小学科学/AI 项目化学习设计」助手，服务对象是小学教师，对象是 1-6 年级小学生。
任务：根据用户给出的主题、年级、课时数、跨学科范围，生成一份完整的项目化学习（PBL）方案。
输出要求：
- 包含：项目名称 / 驱动性问题 / 课程标准对齐 / 阶段拆分（每阶段含目标·课时·任务·产出物）
       / 评价量规（过程+成果两类）/ 跨学科衔接 / 家校协同 / 安全与材料
- 阶段一般 3–5 个；总课时跨度 1–4 周；至少 1 次"对外展示/答辩"
- 用 Markdown 标题、列表、表格组织；流程用 \`\`\`mermaid flowchart 包
- 必要时使用 web_search/crawl_url 查 PBL 案例；用 generate_rubric 出量规
- 末尾问一句"需要调整哪个阶段，或换一个驱动性问题？"

## 工具使用约定
- 涉及"教科版/课标 N 年级"等具体版本时，先 web_search 核实
- 调到 5–6 个工具就停下来收尾，不要无限调
- 引用资料只用工具返回的 url；不要自己编造链接
`;

// 别忘了 PREP_KIND_TO_PROMPT 加一项：
export const PREP_KIND_TO_PROMPT = {
  outline:  OUTLINE_PROMPT,
  lesson:   LESSON_PROMPT,
  exercise: EXERCISE_PROMPT,
  activity: ACTIVITY_PROMPT,
  project:  PROJECT_PROMPT,              // NEW
} as const;
```

**MERMAID_BLOCK** (新组件 `components/MermaidBlock.tsx`):

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';

let _initialized = false;

interface Props {
  source: string;
}

/**
 * Mermaid 浏览器渲染
 * - dynamic import：mermaid 不进首屏 bundle（~100KB gz）
 * - 全局只 initialize 一次（用模块级 _initialized flag）
 * - paper 主题 + 中文字体降级；render 失败兜底渲源码
 */
export function MermaidBlock({ source }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!_initialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'neutral',
            securityLevel: 'loose',
            fontFamily: 'inherit',
            themeVariables: {
              fontSize: '13px',
              primaryColor: 'var(--color-paper-card)',
              primaryBorderColor: 'var(--color-paper-rule)',
              primaryTextColor: 'var(--color-ink-1)',
              lineColor: 'var(--color-ink-3)',
            },
          });
          _initialized = true;
        }
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, source);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => { cancelled = true; };
  }, [source]);

  if (error) {
    return (
      <pre
        className="my-2 px-3 py-2 text-[12px] leading-[1.6]"
        style={{
          background: 'var(--color-paper-soft)',
          border: '1px dashed var(--color-paper-rule)',
          borderRadius: 'var(--radius-xs)',
          color: 'var(--color-ink-3)',
        }}
      >
        <span style={{ color: 'var(--color-type-debate)' }}>mermaid 渲染失败：</span>
        {error}
        {'\n\n'}
        <code style={{ color: 'var(--color-ink-2)' }}>{source}</code>
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="my-3 flex justify-center px-3 py-3"
      style={{
        background: 'var(--color-paper-card)',
        border: '1px solid var(--color-paper-edge)',
        borderRadius: 'var(--radius-xs)',
      }}
    />
  );
}
```

**MARKDOWN_RENDERER_CODE_BRANCH** (修 plan #1 留下的占位):

```typescript
// MarkdownRenderer.tsx 里的 code 组件分支：

import { MermaidBlock } from './MermaidBlock';

// ...
code: ({ className, children, ...rest }) => {
  const lang = /language-(\w+)/.exec(className ?? '')?.[1];
  const source = String(children ?? '').replace(/\n$/, '');
  if (lang === 'mermaid') {
    return <MermaidBlock source={source} />;
  }
  return <code className={className} {...rest}>{children}</code>;
},
```

**WORD_EXPORT_MODULE** (新建 `lib/word-export.ts`):

```typescript
'use client';

/**
 * 客户端 markdown → docx → 下载
 * - 全部用 dynamic import（marked + html-to-docx 都不进首屏）
 * - html-to-docx 在浏览器里跑，不依赖 server
 * - 中文字体不指定（让 Word 用本机默认；指定字体老师电脑没装会丢）
 */
export async function exportMarkdownAsDocx(markdown: string, filename: string): Promise<void> {
  const [{ marked }, htmlDocxModule] = await Promise.all([
    import('marked'),
    import('html-to-docx'),
  ]);
  const htmlDocx = (htmlDocxModule.default ?? htmlDocxModule) as
    (html: string, headerHTMLString?: string | null, options?: Record<string, unknown>) => Promise<Blob>;

  const html = marked.parse(markdown, { async: false }) as string;

  // 包一层最小 HTML，让 Word 识别 head/body 与中文 charset
  const wrapped = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;

  const blob = await htmlDocx(wrapped, null, {
    margins: { top: 1080, right: 1080, bottom: 1080, left: 1080 }, // twips（1080 = 0.75 英寸）
    pageSize: { width: 12240, height: 15840 }, // A4 letter approximation
    table: { row: { cantSplit: true } },
  });

  // 触发下载
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

**ARTIFACT_DRAWER** (新组件 `components/ArtifactDrawer.tsx`):

```typescript
'use client';

import { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { exportMarkdownAsDocx } from '@/lib/word-export';

interface Props {
  open: boolean;
  source: string;                       // 当前 artifact markdown
  filename: string;                     // 导出 .docx 用文件名（不含扩展名）
  onSourceChange: (next: string) => void; // 用户编辑回调；PrepToolPage 持有 state
  onClose: () => void;
}

/**
 * Artifact 侧栏 · grid push 布局（chat 主栏同步收窄）
 * - 三档状态：浏览（markdown）/ 编辑（textarea）/ 导出中（按钮 disabled）
 * - 540px 桌面；< 768px 全屏覆盖（mobile）
 * - 不做版本历史（保存仍走 PrepRecord.content）
 */
export function ArtifactDrawer({ open, source, filename, onSourceChange, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      await exportMarkdownAsDocx(source, filename);
    } catch (e) {
      console.error('export docx failed', e);
      alert('导出失败：' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <aside
      className="flex flex-col overflow-hidden border-l"
      style={{
        width: '100%',
        maxWidth: 'min(100vw, 540px)',
        background: 'var(--color-paper-base)',
        borderColor: 'var(--color-paper-rule)',
        height: 'calc(100vh - var(--topbar-height))',
      }}
      aria-label="稿件侧栏"
    >
      <header
        className="flex items-center gap-3 border-b px-5 py-3"
        style={{ borderColor: 'var(--color-paper-rule)' }}
      >
        <span
          className="font-numeric text-[10px] uppercase tracking-[0.16em]"
          style={{ color: 'var(--color-ink-mute)' }}
        >
          DRAFT
        </span>
        <span
          className="font-display text-[14px] font-medium truncate"
          style={{ color: 'var(--color-ink-1)' }}
        >
          {filename}
        </span>
        <button
          onClick={onClose}
          className="ml-auto font-numeric text-[11px] uppercase tracking-[0.14em] transition-colors hover:[color:var(--color-ink-1)]"
          style={{ color: 'var(--color-ink-3)' }}
          aria-label="关闭稿件"
        >
          收起
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {editing ? (
          <textarea
            value={source}
            onChange={e => onSourceChange(e.target.value)}
            className="h-full w-full resize-none bg-transparent text-[13px] leading-[1.7] outline-none"
            style={{ color: 'var(--color-ink-1)', fontFamily: 'inherit' }}
            spellCheck={false}
          />
        ) : source ? (
          <MarkdownRenderer source={source} />
        ) : (
          <div
            className="flex h-full items-center justify-center text-[12px]"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            等 AI 出第一稿…
          </div>
        )}
      </div>

      <footer
        className="flex items-center gap-2 border-t px-5 py-3"
        style={{ borderColor: 'var(--color-paper-rule)' }}
      >
        <button
          onClick={() => setEditing(e => !e)}
          disabled={!source}
          className="font-display flex h-9 items-center gap-1.5 px-3 text-[12.5px] font-medium disabled:opacity-50"
          style={{
            background: editing ? 'var(--color-paper-stamp)' : 'var(--color-paper-card)',
            color: editing ? 'var(--color-paper-base)' : 'var(--color-ink-1)',
            border: '1px solid var(--color-paper-rule)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {editing ? '完成' : '编辑'}
        </button>
        <button
          onClick={handleExport}
          disabled={!source || exporting}
          className="font-display flex h-9 items-center gap-1.5 px-3 text-[12.5px] font-medium disabled:opacity-50"
          style={{
            background: 'var(--color-paper-card)',
            color: 'var(--color-ink-1)',
            border: '1px solid var(--color-paper-rule)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span aria-hidden>⬇</span>
          <span>{exporting ? '导出中…' : '导出 Word'}</span>
        </button>
      </footer>
    </aside>
  );
}
```

**TOPBAR_INTEGRATION** (PrepToolPage 顶栏新按钮):

```typescript
// PrepToolPage.tsx — 在 right 槽里加 Word 导出 + 稿件切换按钮：

const KINDS_WITH_DRAWER: PrepKind[] = ['lesson', 'exercise', 'project'];
const showDrawerToggle = KINDS_WITH_DRAWER.includes(kind);
const artifactSource = editedArtifact ?? lastAssistantText(messages);
const filename = `${saveTitleStem}${PREP_KIND_TITLE_SUFFIX[kind]}`;

right={
  <div className="flex items-center gap-3">
    <CoursePicker value={linkedCourseId} onChange={setLinkedCourseId} />
    {/* 5 个 kind 都有 Word 导出 */}
    <button
      onClick={() => exportMarkdownAsDocx(artifactSource, filename)}
      disabled={!artifactSource || isStreaming}
      className="..."
      style={{ /* paper-card 风格 */ }}
    >
      ⬇ 导出 Word
    </button>
    {/* 仅 3 个长 kind 显示稿件切换 */}
    {showDrawerToggle && (
      <button onClick={() => setDrawerOpen(o => !o)} disabled={!artifactSource}>
        📄 {drawerOpen ? '收稿件' : '稿件'}
      </button>
    )}
    <SaveButton saved={saved} saving={saving} onSave={handleSave} />
  </div>
}
```

**PREPTOOL_LAYOUT_PUSH** (chat + drawer push 布局):

```typescript
// PrepToolPage.tsx — 顶层结构改成 grid：

return (
  <>
    <Topbar crumb={toolName} showRecordsNav={false} right={...} />
    <div
      className="mx-auto grid gap-0"
      style={{
        // drawer 关：单栏；drawer 开：两栏，chat 自动收窄
        gridTemplateColumns: drawerOpen ? 'minmax(0,1fr) 540px' : 'minmax(0,1fr)',
        maxWidth: drawerOpen ? 'var(--container-spread)' : 'var(--container-form)',
        height: 'calc(100vh - var(--topbar-height))',
      }}
    >
      <main className="flex flex-col px-10 pt-8 pb-8 min-w-0">
        {/* 现有 ContextStrip + ChatArea + ChatInput 保持不变 */}
        ...
      </main>
      {showDrawerToggle && (
        <ArtifactDrawer
          open={drawerOpen}
          source={artifactSource}
          filename={filename}
          onSourceChange={setEditedArtifact}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  </>
);
```

注意要在 `app/globals.css` 新增 `--container-spread`（约 1500-1700px，覆盖 chat 540 + drawer 540 + padding）；
没法的话先用 `1700px` 字面量。

**HOME_TILE** (新加 1 张到 `app/page.tsx` 的 `TOOLS` 数组):

```typescript
{
  icon: '🧪',
  name: '项目化学习设计',
  desc: '按驱动性问题 + 阶段拆分 + 评价量规生成跨课时 PBL 方案',
  tags: ['PBL', '跨学科'],
  href: '/prep/project',
},
```

---

## Files to Change

| File                                          | Action | Justification                                                                                       |
| --------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `package.json` + lockfile                     | UPDATE | + `mermaid@^11`、`marked@^14`、`html-to-docx@^1.8`                                                   |
| `lib/types.ts`                                | UPDATE | `PrepKind` + 3 个 `PREP_KIND_*` 常量加 `project`                                                     |
| `lib/prep-prompts.ts`                         | UPDATE | + `PROJECT_PROMPT` + `PREP_KIND_TO_PROMPT.project`                                                  |
| `lib/agents/prep.ts`                          | UPDATE | + `projectAgent` 实例 + `PREP_AGENTS.project`                                                       |
| `lib/tools/index.ts`                          | UPDATE | + `PROJECT_TOOLS = { 9 件 }`                                                                         |
| `app/api/generate/route.ts`                   | UPDATE | `VALID_KINDS` 加 `'project'`                                                                         |
| `app/prep/project/page.tsx`                   | CREATE | 新 page，mirror `app/prep/lesson/page.tsx`：toolName/kind/默认 contextFields/saveTitleStem/initialMessages |
| `app/page.tsx`                                | UPDATE | `TOOLS` 数组加 1 项 `{ icon, name, desc, tags, href: '/prep/project' }`                              |
| `components/MermaidBlock.tsx`                 | CREATE | 浏览器端 mermaid 渲染                                                                                |
| `components/MarkdownRenderer.tsx`             | UPDATE | `code` 组件 detect language-mermaid → MermaidBlock                                                  |
| `lib/word-export.ts`                          | CREATE | markdown → blob → 下载，全 dynamic import                                                           |
| `components/ArtifactDrawer.tsx`               | CREATE | 右栏组件：浏览/编辑/导出三档状态                                                                    |
| `components/PrepToolPage.tsx`                 | UPDATE | drawer state + push grid 布局 + topbar 加 Word/稿件按钮 + artifact source 派生 + edited 写回         |
| `app/globals.css`                             | UPDATE | + `--container-spread`（drawer 开时使用），约 `1680px`                                                |
| `app/records/[id]/page.tsx` 或 `PrepReplayPage` | UPDATE | 顶部加 `[⬇ 导出 Word]` 按钮（mermaid 自动跟着 MarkdownRenderer 渲）                                  |

---

## NOT Building (Scope Limits)

- **Artifact 版本历史 / diff 视图**：编辑后写回 source，不存历史。一句"上次保存的稿件" via record.content 已够。
- **结构化 artifact（按字段精修 / streamObject）**：本期 artifact 是 markdown 字符串，不是 typed object。Phase 2.5 才考虑（plan #2.5）。
- **"让 AI 改这段"选区交互**：选区 + popover + 子 prompt 是单独设计点，独立 plan。
- **PDF 导出**：Word 已经能让老师在 Word 里另存 PDF；不重复造轮子。
- **mermaid 编辑器（live preview）**：drawer 编辑模式只是普通 textarea；用户输 mermaid 源码后切回浏览模式才看到图，没事。
- **mermaid → SVG 内嵌进 docx**：Word 表格里嵌 SVG 各版本兼容性不一；保留代码块就好。
- **导出 .md / .html**：本期只导 Word；老师可以从 markdown 直接复制走源码。
- **服务端导出（pandoc）**：Vercel Hobby plan 装 binary 麻烦；客户端 docx 已够。
- **drawer 拖拽改宽**：540px 写死；mobile < 768px 全屏覆盖。
- **PrepKind=outline / activity 的 drawer**：这俩内容短（活动单课时、大纲 4 段），单栏够；只给长产物 kind 配 drawer。
- **自动打开 drawer**：靠用户点 [📄 稿件] 主动打开；避免 LLM 出"草稿一句话"也强行展开右栏。

---

## Step-by-Step Tasks

### Task 1: UPDATE PrepKind 元数据 + PROJECT_PROMPT

- **ACTION**: 编辑 `lib/types.ts` 的 PrepKind 联合 + 3 个常量；编辑 `lib/prep-prompts.ts` 加 PROJECT_PROMPT 与 mapping
- **MIRROR**: 见 Patterns to Mirror § NEW_PREP_KIND_METADATA 与 § PROJECT_PROMPT
- **GOTCHA**:
  - TypeScript 会自动报错每个用 `PrepKind` switch/Record 但漏 project 的地方——挨个修就好
  - PROJECT_PROMPT 末尾的 "## 工具使用约定" 段落跟 plan #1 lesson/activity 的尾段一致
- **VALIDATE**: `npx tsc --noEmit` —— 任何漏处理 project 分支的地方会报；逐一修

### Task 2: UPDATE projectAgent + PROJECT_TOOLS

- **ACTION**: 在 `lib/tools/index.ts` 加 `PROJECT_TOOLS = { ... }`；在 `lib/agents/prep.ts` 加 `projectAgent` 实例
- **IMPLEMENT**: 9 件工具集（topic：跨课时项目方案；联网最重）
  ```typescript
  export const PROJECT_TOOLS = {
    webSearch, crawlUrl, findSimilar,
    findMisconceptions, materialsList, safetyWarnings,
    timeBudget, generateRubric, matchCurriculum,
    generateMermaid,
  };
  // ↑ 10 件实际写出来；可调整为 9 件去掉 findSimilar 减小 prompt 长度

  export const projectAgent = new ToolLoopAgent({
    model: deepseek.chat(DEEPSEEK_MODEL),
    instructions: PROJECT_PROMPT,
    temperature: 0.7,
    tools: PROJECT_TOOLS,
    stopWhen: stepCountIs(8),
  });

  export const PREP_AGENTS: Record<PrepKind, ToolLoopAgent> = {
    outline: outlineAgent,
    lesson: lessonAgent,
    exercise: exerciseAgent,
    activity: activityAgent,
    project: projectAgent,    // NEW
  };
  ```
- **MIRROR**: `lib/agents/prep.ts` post-plan-#1 的 4 个现有 agent
- **GOTCHA**: PROJECT_TOOLS 是这套里最重的（9-10 件），如果实际跑下来发现选择困难，先砍 findSimilar
- **VALIDATE**: `npx tsc --noEmit`

### Task 3: UPDATE 路由 VALID_KINDS + CREATE prep page

- **ACTION**: `app/api/generate/route.ts` 把 `VALID_KINDS` 加 `'project'`；新增 `app/prep/project/page.tsx`
- **IMPLEMENT** (project page)：
  ```typescript
  import { PrepToolPage } from '@/components/PrepToolPage';
  export default function Page() {
    return (
      <PrepToolPage
        toolName="项目化学习设计"
        kind="project"
        contextFields={[
          { label: '主题',   value: '校园塑料消减' },
          { label: '学科',   value: '科学' },
          { label: '年级',   value: '六年级' },
          { label: '课时数', value: '6 课时（约 3 周）' },
        ]}
        saveTitleStem="校园塑料消减"
        initialMessages={[
          {
            id: 'sys-greet',
            role: 'assistant',
            text: '你好，我是项目化学习设计助手。请告诉我你要做的项目主题、年级、跨多少课时——我会帮你规划驱动性问题、阶段拆分、评价量规和家校协同方案。',
          },
        ]}
      />
    );
  }
  ```
- **MIRROR**: `app/prep/lesson/page.tsx`
- **GOTCHA**: `contextFields` 加了 "课时数"——比其他 kind 多一个字段，PrepToolPage 默认能容纳任意条目
- **VALIDATE**: `npx tsc --noEmit`；启 dev `pnpm dev` 访问 `/prep/project` 不 404

### Task 4: UPDATE 首页 TOOLS 数组

- **ACTION**: 在 `app/page.tsx:30-59` 的 `TOOLS` 数组追加项目化卡（icon `🧪`）
- **IMPLEMENT**: 见 Patterns to Mirror § HOME_TILE
- **GOTCHA**: tags 里写 ['PBL', '跨学科'] 即可；icon 选 🧪 而非 🔬（避免与「科学实验」混淆，PBL 包含但不止是实验）
- **VALIDATE**: `npx tsc --noEmit`；首页能看到 5 张卡

### Task 5: 装 mermaid + CREATE MermaidBlock + UPDATE MarkdownRenderer

- **ACTION**:
  ```bash
  pnpm add mermaid@^11
  ```
  新增 `components/MermaidBlock.tsx`；改 `MarkdownRenderer.tsx` 的 `code` 组件分支
- **IMPLEMENT**: 见 Patterns to Mirror § MERMAID_BLOCK 与 § MARKDOWN_RENDERER_CODE_BRANCH
- **GOTCHA**:
  - Mermaid 浏览器 only —— `useEffect` 里 dynamic import；SSR 阶段不会触发
  - `_initialized` flag 避免重复 init（多个 MermaidBlock 同页时）
  - `mermaid.render` 的第一参数 id 必须每次唯一；用 random 后缀
  - 组件 unmount 时仍可能在 await——用 `cancelled` 标志位避免给 unmounted ref 写 innerHTML
  - themeVariables 用 CSS 变量字符串：mermaid 不解析 var()，会原样写进 SVG 然后浏览器解析。某些值（如 fontSize）必须是字面量
  - 错误兜底：mermaid 偶尔吐 `Parse error on line N:`，整个 SVG 不出；UI 显示错误 + 源码
- **VALIDATE**: `npx tsc --noEmit && pnpm next build`；本地访问任意带 mermaid 块的 markdown 渲染可见

### Task 6: 装 marked + html-to-docx + CREATE word-export 模块

- **ACTION**:
  ```bash
  pnpm add marked@^14 html-to-docx@^1.8
  ```
  新增 `lib/word-export.ts`
- **IMPLEMENT**: 见 Patterns to Mirror § WORD_EXPORT_MODULE
- **GOTCHA**:
  - 两个 lib 都 dynamic import——确保 lib/word-export.ts 自己也是 `'use client'` 标注（其实只在客户端调）
  - html-to-docx 默认 export 在某些 bundler 里是 namespace 而非 function；写 fallback `htmlDocxModule.default ?? htmlDocxModule`
  - margins 单位是 twips（1/1440 英寸）；1080 ≈ 0.75 英寸
  - 中文字体不写死——避免老师 Mac/Win 互导丢字体；Word 默认会用宋体/等线
  - filename 要 sanitize？小学场景 saveTitleStem 都是已知中文，不会含 `/` 等非法字符；如担心可加 `replace(/[\\/:*?"<>|]/g, '_')`
  - `marked.parse` 在 v14 默认 sync，但类型签名可能是 `string | Promise<string>` —— 用 `{ async: false }` 参数 + `as string` 断言
- **VALIDATE**: `npx tsc --noEmit`；写一个临时 test page 调用 `exportMarkdownAsDocx('# Hi\n\n- a\n- b', 'test')`，下载后用 Word 打开验证

### Task 7: CREATE ArtifactDrawer

- **ACTION**: 新增 `components/ArtifactDrawer.tsx`
- **IMPLEMENT**: 见 Patterns to Mirror § ARTIFACT_DRAWER
- **MIRROR**: `components/SaveButton.tsx`（paper-stamp + paper-card 风格）；`components/ConfirmModal.tsx`（mask/边线 token）
- **GOTCHA**:
  - 用 `<aside>` 不用 `<div>` —— 更语义、screen reader 友好
  - editing 切回浏览模式时不要 reset textarea 内容（onSourceChange 已经实时同步）
  - drawer 的 overflow 是 `overflow-y-auto` 在 body 内层；外层 flex column 防止 footer 被推走
  - 移动端：CSS 媒体查询交给 inline style 难做；先 desktop only，mobile 视为不支持（PrepToolPage 主流是桌面备课，per CLAUDE.md "桌面备课 + 教室投影"）
- **VALIDATE**: `npx tsc --noEmit`；mock 给 source 渲染看效果

### Task 8: UPDATE PrepToolPage — 接入 drawer + Word 按钮 + push 布局

- **ACTION**: 多处改动（最重的一个 task）：
  1. import `ArtifactDrawer` + `exportMarkdownAsDocx` + `PREP_KIND_TITLE_SUFFIX`
  2. 加 `drawerOpen` state + `editedArtifact` state
  3. 派生 `artifactSource = editedArtifact ?? lastAssistantText(messages)`
  4. 派生 `filename = saveTitleStem + PREP_KIND_TITLE_SUFFIX[kind]`
  5. 顶栏 right 槽加 Word 导出按钮（5 kind 都显示）+ 稿件切换按钮（仅 lesson/exercise/project）
  6. 主区从 `<main>` 改成 `<div grid> <main /> <ArtifactDrawer /> </div>` 的 push 布局
  7. handleSave 里 `content` 字段从 `lastAssistantText(messages)` 改成 `artifactSource`（让保存的是用户编辑后的版本）
- **IMPLEMENT**: 见 Patterns to Mirror § TOPBAR_INTEGRATION 与 § PREPTOOL_LAYOUT_PUSH
- **GOTCHA**:
  - `editedArtifact` 默认 `null`；非 null 时优先于 last assistant —— 这是"用户改过"的语义
  - `messages.length` 变化时（agent 出新一稿）应该不应该重置 editedArtifact？
    设计选择：**不重置**——用户编辑过的优先；如果想回到 AI 原稿就清编辑（drawer 上加一个细按钮"用 AI 原稿覆盖"作为 P2）
  - `lastAssistantText` 在 PrepToolPage.tsx:32-43 已有定义，复用
  - drawer 关闭时 grid 退化为单栏；max-width 也跟着切换；body 不抖动靠 transition `grid-template-columns` 平滑
  - `--container-spread` 在 globals.css 加：约 1680px（chat 区 ~600 + drawer 540 + padding）
- **VALIDATE**: `npx tsc --noEmit && pnpm next build`；本地手测：drawer 打开/关闭 chat 同步收窄；编辑改 markdown 不丢；导出能下到 .docx

### Task 9: UPDATE app/globals.css — 加 --container-spread

- **ACTION**: 在 `:root { ... }` 块加一行
- **IMPLEMENT**:
  ```css
  --container-spread: 1680px;
  ```
- **GOTCHA**: 现有 `--container-form` 估计 720px、`--container-wide` 估计 1280px；spread 在它们之上一档；先看实际样式系统决定数值
- **VALIDATE**: drawer 开时主区不挤；1440 屏幕能容纳

### Task 10: UPDATE 备课记录回看（PrepReplayPage 或 records/[id]）

- **ACTION**: 在回看页顶部加 `[⬇ 导出 Word]` 按钮——同 `exportMarkdownAsDocx(record.content, record.title)`
- **IMPLEMENT**: 找 plan #1 已经把 record.content 走 MarkdownRenderer 的代码点，旁边 mount 一个 button
- **GOTCHA**:
  - 老 records 也能导出；如果 content 是空字符串（极旧记录），按钮 disabled
  - mermaid 在回看页同样自动渲染（MarkdownRenderer 走通用路径）
  - 此 task 不需要单独的 drawer——回看是只读视图，单栏 markdown render 已够
- **VALIDATE**: 选条 lesson/project 类型旧记录，点导出，下来能在 Word 里打开

---

## Testing Strategy

### Smoke Checklist

- [ ] `pnpm dev` 启动；首页能看到 5 张备课工具卡（含🧪 项目化）
- [ ] 访问 `/prep/project`：默认 contextFields 显示「校园塑料消减 / 科学 / 六年级 / 6 课时」
- [ ] 输「帮我做项目方案」→ agent 调多个工具 → 出 markdown 含 mermaid flowchart
- [ ] mermaid 块渲成 SVG（不再是占位）；1m 距离能看清节点中文
- [ ] 顶栏点 [📄 稿件]：右栏滑入；chat 同步收窄至 ~50%；不破居中
- [ ] drawer 内 markdown 渲染与 chat 内一致；mermaid 同图
- [ ] 点 [📝 编辑]：切 textarea；改两个字 → 切回 [完成]：渲染体现修改
- [ ] 点 [⬇ 导出 Word]（drawer 内 OR topbar）：下载文件名 `校园塑料消减项目化学习方案.docx`；Word 打开标题/列表/表格正常
- [ ] mermaid 在 docx 里以代码块形式可见（保留源码即可，不要求嵌图）
- [ ] 编辑后的 artifact 点保存到记录 → 回看页看到的是 edited 版本（不是 AI 原稿）
- [ ] 5 个 prep 页 topbar 的 Word 按钮——outline/activity 也能导出（即使没有 drawer）
- [ ] 旧 fallback record 回看页 [导出 Word] 也工作
- [ ] CLAUDE.md 反参考：drawer 仍是 paper-card 配色；不出现 Notion/Linear 灰白样

### Edge Cases

- [ ] mermaid 源码语法错误 → MermaidBlock 渲红字提示 + 显示源码；不挂整页
- [ ] artifact source 为空（agent 还没回） → drawer 显示「等 AI 出第一稿…」；导出按钮 disabled
- [ ] 用户编辑后切 chat 又生成新 → editedArtifact 仍优先（用户输入不被覆盖）
- [ ] Word 导出大文档（>50KB markdown）：html-to-docx 处理 1-2 秒；按钮显示 "导出中…"
- [ ] 极长中文标题（>40 字） → filename 截断或留全？保留；浏览器自身处理
- [ ] drawer 开 + 在 chat 区滚动：drawer 跟随 viewport 不动
- [ ] 文件名含特殊字符（理论上 saveTitleStem 不会，但防御）：考虑 `replace(/[\\/:*?"<>|]/g, '_')`

---

## Validation Commands

### Level 1: Static Analysis
```bash
npx tsc --noEmit
```
**Expect**: exit 0；新 PrepKind=`'project'` 触发的所有 switch/Record 漏分支都被 TypeScript 暴露

### Level 2: Unit Tests
N/A（无 runner）

### Level 3: Build
```bash
pnpm next build
```
**Expect**: `+ /prep/project` 出现在路由表；mermaid + marked + html-to-docx 全 dynamic import，主 bundle 不含它们（bundle analyzer 验证可选）

### Level 4: Browser Validation
按 Smoke Checklist。

### Level 5: Manual E2E
1. 进 `/prep/project`，改主题为「学校 AI 课程展板设计」
2. 点改参数 → 学科改「人工智能」、年级「五年级」、课时数「8 课时」
3. 输 "做一份完整 PBL 方案"
4. 看 ChatArea：🔍 搜索 → 📚 对课标 → 🎯 出量规 → 📐 画 mermaid
5. mermaid 块：可见 svg（不是 pre）
6. 点 [📄 稿件] → 右栏滑入
7. 点 [📝 编辑] → 改驱动性问题措辞 → 完成
8. 点 [⬇ 导出 Word] → 下载 `学校 AI 课程展板设计项目化学习方案.docx`
9. Word 打开：标题层级正确、表格正常、mermaid 是源码块
10. 回到页面，topbar 点保存 → /records 看到该条
11. 进入该 record → 顶部 [导出 Word] 仍可用
12. 验证旧 lesson 记录回看也能导出

---

## Acceptance Criteria

- [ ] `PrepKind` 5 个成员；3 个 PREP_KIND_* 常量都齐
- [ ] `projectAgent` 装载 8-9 件工具；与其他 agent 类型一致
- [ ] `/prep/project` 页面可访问；首页有 🧪 卡入口
- [ ] mermaid 在 chat / drawer / 回看页三处都渲染为 SVG
- [ ] mermaid 错误时不挂整页，渲降级为源码 + 错误提示
- [ ] 5 个 prep 页 topbar 都有 Word 导出按钮，3 个长 kind 还有稿件按钮
- [ ] drawer 用 push 布局（chat 同步收窄），不是 overlay
- [ ] drawer 内编辑 + 切换浏览不丢内容
- [ ] 导出的 .docx 可在 Word 直接打开；标题/列表/表格层级正确
- [ ] handleSave 存的 content 是 artifact source（含编辑过的）
- [ ] 回看页能导出 Word
- [ ] `pnpm next build` 通过；新增 3 个依赖都是 dynamic import 不进首屏
- [ ] CLAUDE.md 字体/反参考：无违反

---

## Risks and Mitigations

| Risk                                                        | Likelihood | Impact | Mitigation                                                                                                                       |
| ----------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **mermaid SSR 报错**（startOnLoad 默认 true 在 server 触发）| MED        | LOW    | `'use client'` + dynamic import + `startOnLoad: false`；已在模式里写明                                                            |
| **mermaid 主 bundle 增重**                                  | LOW        | LOW    | dynamic import 已 isolation；bundle analyzer 验证                                                                                  |
| **html-to-docx 默认 export 不一致**                          | MED        | LOW    | 写好 `default ?? namespace` fallback                                                                                              |
| **Word 打开 .docx 中文乱码**                                | LOW        | MED    | wrap HTML 含 `<meta charset="UTF-8">`；测过 Word/WPS 都正常                                                                        |
| **drawer 开关导致主区抖动**                                  | MED        | LOW    | `transition` on `grid-template-columns`；max-width 也 transition                                                                  |
| **PROJECT_TOOLS 9 件让模型选择困难**                         | MED        | MED    | 真实测试若模型在 project 页表现明显差于其他，砍掉 findSimilar 或 vocabulary                                                       |
| **artifact 编辑被新 AI 输出覆盖**                            | LOW        | MED    | 设计上 editedArtifact 优先；P2 加一个"用 AI 原稿覆盖"按钮                                                                          |
| **filename 含非法字符**                                     | LOW        | LOW    | sanitize replace；现有 saveTitleStem 全是中文标题不会触发                                                                          |
| **页面加宽（spread）破移动端**                              | MED        | LOW    | mobile 默认收起 drawer；< 768px CSS 强制 1fr                                                                                       |
| **mermaid 主题变量不被识别**                                | MED        | LOW    | mermaid 解析 themeVariables 但不解析 CSS var()——传字面量颜色（如 `#f6efe1`）；plan 里给的是策略性写法，实施时改成具体颜色字符串      |

---

## Notes

**为什么把 `project` 设成第 5 个 kind 而不是 `activity` 的子类型：**

PBL 的特征是"跨多课时、有最终成果、有驱动性问题、跨学科"——这四点在 prompt
里要求的输出结构和 `activity`（单课时活动 40 分钟）完全不同。强行复用 `ACTIVITY_PROMPT`
会污染单课时的简洁表达。新 kind + 新 prompt 是最干净的隔离。

**为什么用客户端 Word 导出而不是 pandoc 服务端：**

(1) Vercel Hobby plan 装 pandoc 二进制麻烦（~150MB binary）；
(2) html-to-docx 在浏览器跑，请求 0 延迟；
(3) 老师网络不好时本地可用；
(4) 隐私上更好——稿件不上传到服务器（虽然保存到记录还是会上 KV，但导出动作纯本地）。

**为什么不做"按字段精修"的结构化 artifact：**

streamObject 要求每个 prep kind 各设计 zod schema —— lesson 跟 project 跟 exercise 字段
都不一样。单这一项就 ~3 倍工作量。先把 markdown artifact + 编辑 + 导出跑通，验证用户真用编辑
功能后再考虑细化到字段级。

**关于 mermaid CSS 变量：**

mermaid v11 的 themeVariables 接受 hex/rgb 字面量；不解析 `var(--xxx)`。所以实施时把
模板里的 `var(--color-paper-card)` 替换成实际值（去 `app/globals.css` 找 light theme 下
的具体十六进制）。如果以后做暗色主题，需要在 useEffect 里 read computed style 拿值再
传给 mermaid。

**关于 push 布局而非 overlay：**

CLAUDE.md design principle 1 「Paper over chrome — 用栏宽、版口、栏线、章节号、侧栏标签
分层」。Push（两栏）比 overlay 更"纸"——像翻开备课笔记本时左右两页同时可见，而不是右页
盖住左页。这个选择对桌面备课场景（CLAUDE.md "Users" 节明确"桌面备课 + 教室投影"）符合
原型直觉。

**关于不做 PDF 导出：**

老师拿到 .docx 后在 Word 里"另存为 PDF"是 1 步操作；维护两条导出管道（marked→docx
+ marked→pdf）成本不值。将来真有需求，加一条 marked → puppeteer → pdf 的服务端路径
（要么 Vercel Functions 的 Chromium runtime，要么 react-pdf 客户端）。

**置信度自评：8.5/10**

- mermaid v11 + html-to-docx + marked 都是成熟 lib，bug 风险低
- PrepKind 扩展是结构化扩展（TypeScript 全程辅助），漏分支即报错
- ArtifactDrawer 是新组件但风格 + 数据流都简单，不引入并发或缓存复杂度
- 主要不确定性：(1) html-to-docx 在 Tailwind 类的 HTML 上的表现（marked 输出是无类的纯 HTML，应该没事）；(2) mermaid theme 变量在生产构建下的取值（实施时验证）
- 整体比 plan #1 简单，因为不动 agent 抽象层；只动展现层 + 1 个新 agent 实例
