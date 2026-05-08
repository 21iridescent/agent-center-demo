import { z } from 'zod';

/**
 * 三类智能体的配置 schema
 * - 服务端：作为 ToolLoopAgent 的 tool inputSchema
 * - 客户端：作为可编辑表单的字段定义
 * 单一真源，避免 schema 漂移
 */

const SUBJECT = z.enum(['科学', '人工智能']);
const GRADE = z.enum([
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
]);

/* ═══════════════════════════════════════════════════════════════
   AI 学问（虚拟人对话）
   ═══════════════════════════════════════════════════════════════ */

export const XuewenAgentSchema = z.object({
  name: z.string().min(1).describe('智能体名称（如「牛顿」「居里夫人」）'),
  background: z
    .string()
    .min(10)
    .describe('角色背景介绍 + 性格 + 说话风格（80-200 字）'),
  subject: SUBJECT.describe('所属学科'),
  grade: GRADE.describe('适用年级'),
  voiceStyle: z
    .string()
    .optional()
    .describe('音色描述，如「沉稳男声·适合历史人物」'),
  knowledgeBases: z
    .array(z.string())
    .default([])
    .describe('知识库标签数组，如 ["教科版六年级科学"]'),
});
export type XuewenAgentConfig = z.infer<typeof XuewenAgentSchema>;

/* ═══════════════════════════════════════════════════════════════
   AI 思辨·辩论
   ═══════════════════════════════════════════════════════════════ */

const DebateSide = z.object({
  type: z
    .enum(['ai', 'human'])
    .describe('参与者类型：ai = 由 AI 自动发言；human = 真人/学生手动发言'),
  argument: z
    .string()
    .min(10)
    .describe('一两句话写明立场和主要论据，AI 类型时按此自动发言'),
});

export const DebateAgentSchema = z.object({
  name: z.string().min(1).describe('智能体名称'),
  topic: z.string().min(1).describe('辩题（如「一次性塑料袋是否应禁用」）'),
  background: z.string().describe('辩题背景说明（让 AI 评委有判断依据）'),
  subject: SUBJECT,
  grade: GRADE,
  proSide: DebateSide.describe('正方设置'),
  conSide: DebateSide.describe('反方设置'),
  roundDurationSec: z
    .union([z.literal(60), z.literal(120), z.literal(180), z.literal(300)])
    .default(120)
    .describe('每轮发言倒计时秒数'),
  totalRounds: z
    .union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .default(3)
    .describe('辩论总轮数'),
  judgeTemplate: z
    .enum(['default', 'strict', 'encouraging', 'neutral'])
    .default('default')
    .describe('AI 评委语气模板：default=默认 / strict=严格 / encouraging=鼓励 / neutral=中性'),
});
export type DebateAgentConfig = z.infer<typeof DebateAgentSchema>;

/* ═══════════════════════════════════════════════════════════════
   AI 思辨·讨论
   ═══════════════════════════════════════════════════════════════ */

const Scaffold = z.object({
  label: z.string().describe('支架标签，如「① 提出新观点」'),
  template: z
    .string()
    .describe('模板句，含 <空> 占位符，如「我的观点是<空>，依据是<空>」'),
});

export const DiscussionAgentSchema = z.object({
  name: z.string().min(1).describe('智能体名称'),
  topic: z.string().min(1).describe('讨论主题'),
  subject: SUBJECT,
  grade: GRADE,
  hostName: z.string().min(1).describe('主持人/虚拟引导人名称'),
  hostStyle: z
    .string()
    .describe('主持风格（如「鼓励发散；当冷场时主动追问」）'),
  durationMinutes: z
    .union([z.literal(20), z.literal(30), z.literal(45), z.literal(60)])
    .default(30)
    .describe('讨论总时长（分钟）'),
  scaffolds: z
    .array(Scaffold)
    .length(6)
    .describe('恰好 6 个观点支架（标签 + 模板句）'),
});
export type DiscussionAgentConfig = z.infer<typeof DiscussionAgentSchema>;

/* ═══════════════════════════════════════════════════════════════
   通用
   ═══════════════════════════════════════════════════════════════ */

export type CreateKind = 'xuewen' | 'debate' | 'discussion';

export const CREATE_KIND_LABEL: Record<CreateKind, string> = {
  xuewen: 'AI 学问',
  debate: 'AI 辩论',
  discussion: 'AI 讨论',
};

export const CREATE_TOOL_NAME: Record<CreateKind, string> = {
  xuewen: 'proposeXuewenAgent',
  debate: 'proposeDebateAgent',
  discussion: 'proposeDiscussionAgent',
};
