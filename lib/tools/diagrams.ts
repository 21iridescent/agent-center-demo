import { tool, generateObject } from 'ai';
import { z } from 'zod';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';

/**
 * 可视化工具 — mermaid 图表生成（LLM-as-tool）
 * 返回 mermaid source 字符串；前端在 markdown 内 ```mermaid 代码块呈现
 * （本期 plan 阶段是占位，下一 plan 会替换为浏览器实渲染）。
 */

const helperModel = deepseek.chat(DEEPSEEK_MODEL);

export const generateMermaid = tool({
  description:
    '生成 mermaid 图表源码（流程图 / 思维导图 / 时序图 / 类层次）。返回的 source 由前端在 ```mermaid 代码块呈现。当教案需要"水循环""光路""项目阶段流"等结构图时调用。',
  inputSchema: z.object({
    kind: z
      .enum(['flowchart', 'mindmap', 'sequence', 'classDiagram'])
      .describe('图表类型'),
    topic: z.string().describe('主题，如"水循环"或"塑料降解流程"'),
    hint: z
      .string()
      .optional()
      .describe('结构提示，如"4 阶段：蒸发→冷凝→降水→汇流"'),
  }),
  execute: async ({ kind, topic, hint }) => {
    const { object } = await generateObject({
      model: helperModel,
      schema: z.object({ mermaid: z.string() }),
      prompt: `生成 mermaid ${kind}，主题「${topic}」${hint ? `，结构提示：${hint}` : ''}。
要求：
- 节点中文，每条边标注关系或时间顺序
- 不超过 8 个节点
- 首行写图表类型声明（如 \`flowchart LR\` 或 \`mindmap\` 或 \`sequenceDiagram\` 或 \`classDiagram\`）
- 不要返回多余解释、不要包 \`\`\`mermaid 代码块标记
- 直接返回纯 mermaid source（前端会自动包代码块）`,
      temperature: 0.4,
    });
    return object;
  },
});
