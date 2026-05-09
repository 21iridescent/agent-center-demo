import { tool } from 'ai';
import { z } from 'zod';

/**
 * Canvas/稿件 写入工具
 *
 * 设计：execute 是 no-op —— markdown 直接放在 tool input 里，UI 从 input 读出。
 * 这样：
 * - AI 一调用，PrepToolPage 立即拿到 input.markdown 渲染到 ArtifactDrawer
 * - 不进 chat bubble；chat 里只看到 "📝 写入稿件 · N 字" 状态条
 * - 后续修改 = 再调一次 writeCanvas 传新版完整 markdown
 *
 * 这个 tool 与 web_search 等并列，但其作用是「把 chat 流程切到 canvas 写作模式」
 * —— 调用它就意味着「资料搜集结束，开始写稿」。
 */
export const writeCanvas = tool({
  description:
    '把当前稿件【整体写入或重写】成新的 markdown。' +
    '只在两种情况调用：(1) 第一次出稿；(2) 改动范围很大（>30% 内容）需要整体重排。' +
    '小改动用 editCanvas，不要用本工具反复全量重写。' +
    '调用后在 chat 里只回一句话告诉用户这一稿做了什么 + 问"需要改哪里？"',
  inputSchema: z.object({
    markdown: z
      .string()
      .min(1)
      .describe('完整的 markdown 稿件。会替换 canvas 全部内容。'),
    summary: z
      .string()
      .optional()
      .describe('可选 · 一句话告诉用户这一稿改了什么。'),
  }),
  execute: async ({ markdown, summary }) => {
    return {
      ok: true as const,
      length: markdown.length,
      summary: summary ?? '',
    };
  },
});

/**
 * Canvas 局部精修工具
 *
 * 与 writeCanvas 的关系：
 * - writeCanvas = 整稿写入 / 大改重排（覆盖全部）
 * - editCanvas  = 局部精修（不直接生效，进入 pending 状态等老师 Apply / Cancel）
 *
 * 设计：execute 是 no-op —— find / replace / reason 都在 tool input 里，
 * UI 从 input 读出，渲染成"待审改动"卡片，老师审核：
 *   [Apply]  → PrepToolPage 把 find→replace 应用到 canvas
 *   [Cancel] → 标记 rejected，从 pending 列表消失
 *
 * 多个 editCanvas 调用 = 多个独立 pending 卡片，互不干扰。
 */
export const editCanvas = tool({
  description:
    '对 canvas 现有 markdown 做【局部精修】。提供原文片段（find）+ 替换内容（replace），' +
    '改动不会直接生效——会作为"待审改动"显示在 canvas 顶部，由老师点 Apply 或 Cancel 决定。' +
    '只用于小改（一处描述、一段调整、一个错别字）；超过 30% 内容变动用 writeCanvas 整体重写。' +
    'find 必须是 canvas 当前 markdown 中**唯一连续的子串**（不能跨过多段标题；建议 5-200 字）。' +
    'replace 可以为空字符串 = 删除该片段。',
  inputSchema: z.object({
    find: z
      .string()
      .min(1)
      .describe('canvas 中要替换的原文片段。必须是连续唯一子串；保留原文换行/缩进；建议 5–200 字。'),
    replace: z
      .string()
      .describe('替换为的新内容；空串 = 删除。'),
    reason: z
      .string()
      .optional()
      .describe('一句话解释为什么这么改 —— 显示在 pending 卡片标题。'),
  }),
  execute: async ({ find, replace, reason }) => {
    return {
      ok: true as const,
      reason: reason ?? '',
      findLength: find.length,
      replaceLength: replace.length,
    };
  },
});
