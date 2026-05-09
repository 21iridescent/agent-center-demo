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
 * 两种 anchorType：
 * - 'exact'   : find 是要被替换的**精确文本片段**；适合改一句话 / 改一个词 / 改一小段。
 * - 'section' : find 是某章节的 **heading 行**（如 "## 一、课前导入（约 3 分钟）"），
 *               canvas 端会自动把"该 heading 到下一个同级或更高级 heading 之间的全部内容"
 *               作为替换范围。适合"重写整节" —— AI 只要 verbatim 抄一行 heading，
 *               不用把整段几百字的旧内容都塞进 find（旧内容容易抄错、产生幻觉）。
 *
 * 设计：execute 是 no-op —— 改动作为 pending 卡片在 UI 由老师审核：
 *   [Apply]  → PrepToolPage 走 lib/canvas-edit 应用 find→replace
 *   [Cancel] → 标记 rejected，从 pending 列表消失
 *
 * 多个 editCanvas 调用 = 多个独立 pending 卡片，互不干扰。
 */
export const editCanvas = tool({
  description: [
    '对 canvas 现有 markdown 做【局部精修】，作为"待审改动"显示给老师审核（不直接生效）。',
    '只用于小改：一句话 / 一段调整 / 重写某节。改动 >30% 内容请用 writeCanvas 整体重写。',
    '',
    '【anchorType = "exact"（默认 · 改一处）】',
    '  find = 当前 canvas 中**字面存在**的片段（5-120 字最佳；保留换行 / 标点）',
    '  replace = 替换为的新内容（空串 = 删除）',
    '  ⚠ find 必须从 canvas 当前内容里 verbatim 复制 —— 不要凭记忆或想象，',
    '     不要从你之前给过的版本里抄（writeCanvas 多次后旧版已被覆盖）。',
    '     如果你不确定原文长什么样，直接用 anchorType="section" + heading 锚定。',
    '',
    '【anchorType = "section"（改一节）】',
    '  find = 该节的 heading **整行**（如 "## 一、课前导入（5 分钟）"）',
    '         必须 verbatim 抄当前 canvas 里的 heading 行；只要 heading 对得上，',
    '         整节正文有差异都不会让 edit 失败 —— 这是更稳的写整节的方式。',
    '  replace = 整节的新内容（含 heading 行本身 + 全部正文）',
    '',
    '原则：能用 section 就别用 exact —— heading 短而独特，不易写错。',
    'exact 留给"只改一句话"这种小手术。',
  ].join('\n'),
  inputSchema: z.object({
    find: z
      .string()
      .min(1)
      .describe(
        'canvas 中的定位锚：anchorType=exact 时是要被替换的精确文本片段（5-120 字）；' +
          'anchorType=section 时是该节的 heading 整行（如 "## 一、课前导入（5 分钟）"）。' +
          '必须从当前 canvas 字面复制，不能臆造或凭记忆写。',
      ),
    replace: z
      .string()
      .describe(
        '替换为的新内容。anchorType=section 时必须包含 heading 行 + 整节正文；空串 = 删除该范围。',
      ),
    anchorType: z
      .enum(['exact', 'section'])
      .default('exact')
      .describe(
        'exact = 替换 find 这段精确文本；section = find 是 heading，替换"该 heading → 下一同级或更高级 heading"之间的整节。' +
          '改一节优先用 section，find 写 heading 即可，比抄整段正文更稳。',
      ),
    reason: z
      .string()
      .optional()
      .describe('一句话解释为什么这么改 —— 显示在 pending 卡片标题。'),
  }),
  execute: async ({ find, replace, reason, anchorType }) => {
    return {
      ok: true as const,
      reason: reason ?? '',
      anchorType: anchorType ?? 'exact',
      findLength: find.length,
      replaceLength: replace.length,
    };
  },
});
