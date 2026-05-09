import { z } from 'zod';
import {
  XUEWEN_PERSONA_IDS,
  XUEWEN_BG_IDS,
  DEBATE_BG_IDS,
  DEBATE_ACTOR_IDS,
  TOPIC_THUMB_IDS,
  DISCUSSION_BG_IDS,
} from './asset-catalog';

/**
 * 三类智能体的配置 schema
 * - 服务端：作为 ToolLoopAgent 的 tool inputSchema
 * - 客户端：作为可编辑表单的字段定义
 * 单一真源，避免 schema 漂移
 *
 * 资源字段（personaId / bgAsset / actorId / thumbAsset）的 enum 候选
 * 由 lib/asset-catalog.ts 派生，物理素材在 public/assets/generated/
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
  personaId: z
    .enum(XUEWEN_PERSONA_IDS)
    .optional()
    .describe(
      '虚拟人物原型 id；6 个候选：newton/curie/darwin/socrates/galileo/tong-dizhou —— 决定使用页头像和全身像（来自素材目录）',
    ),
  bgAsset: z
    .enum(XUEWEN_BG_IDS)
    .optional()
    .describe(
      '背景场景 id；3 个候选：classical-academy（古典书院·适合人文/历史）/ science-lab（科学实验室·默认）/ natural-history（自然博物·适合生物/进化）',
    ),
  personaCustom: z
    .object({
      avatarUrl: z.string().describe('512×512 头像 URL（可为 data: URL）'),
      roleUrl: z.string().describe('1024×1536 全身像 URL（可为 data: URL）'),
      sourcePrompt: z
        .string()
        .optional()
        .describe('生成时所用 prompt，便于复现；前端会回填'),
    })
    .optional()
    .describe(
      '当 personaId 不在 6 人 catalog 时，AI 现画的人物形象；与 personaId 互斥。LLM 不要直接填 URL（留空），由前端 [✨ AI 生成] 触发并回填。',
    ),
  coldStart: z
    .string()
    .optional()
    .describe(
      '使用页 assistant 第一句开场白；80-120 字，第一人称介绍角色 + 邀请提问；与 background 风格一致',
    ),
  linkedCourseId: z
    .string()
    .optional()
    .describe('已关联的课程 id（来自 lib/courses.ts COURSE_SEEDS）；undefined 表示未关联'),
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
  actorId: z
    .enum(DEBATE_ACTOR_IDS)
    .optional()
    .describe(
      '辩手全身像 id；4 个候选：pro-ai/con-ai/pro-student/con-student（与 type 联动：type=ai 倾向 *-ai，type=human 倾向 *-student）',
    ),
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
  bgAsset: z
    .enum(DEBATE_BG_IDS)
    .optional()
    .describe('辩论场景背景 id；当前候选：stage-balanced（平衡擂台）'),
  thumbAsset: z
    .enum(TOPIC_THUMB_IDS)
    .optional()
    .describe(
      '辩题封面 id；可选，按辩题关键词推荐：塑料→plastic-ocean / 降解→biodegradable / 数据→ocean-data-board / 政策→policy-brief / 论点→argument-cards 等',
    ),
  coldStart: z
    .string()
    .optional()
    .describe(
      '辩论使用页"赛前提示词"开场，80-120 字，主持人口吻宣布辩题、双方简介，最后一句鼓励发言',
    ),
  linkedCourseId: z
    .string()
    .optional()
    .describe('已关联的课程 id（来自 lib/courses.ts COURSE_SEEDS）；undefined 表示未关联'),
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
  bgAsset: z
    .enum(DISCUSSION_BG_IDS)
    .optional()
    .describe('讨论场景背景 id；当前候选：classroom-roundtable（圆桌教室）'),
  coldStart: z
    .string()
    .optional()
    .describe(
      '讨论使用页主持人开场，80-120 字，抛出主题 + 鼓励发言 + 提示用观点支架',
    ),
  linkedCourseId: z
    .string()
    .optional()
    .describe('已关联的课程 id（来自 lib/courses.ts COURSE_SEEDS）；undefined 表示未关联'),
});
export type DiscussionAgentConfig = z.infer<typeof DiscussionAgentSchema>;

/* ═══════════════════════════════════════════════════════════════
   通用
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   辩论运行时可信化校验 schema
   —— 老师在使用页可改 topic/rounds/judge/args（"对方变量"覆盖），
      服务端只信白名单字段，且每个字段走 Zod 校验
   ═══════════════════════════════════════════════════════════════ */

export const DebateOverrideSchema = z
  .object({
    topic: z.string().min(1).max(200).optional(),
    totalRounds: z
      .union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .optional(),
    judgeTemplate: z
      .enum(['default', 'strict', 'encouraging', 'neutral'])
      .optional(),
    proArg: z.string().min(10).max(800).optional(),
    conArg: z.string().min(10).max(800).optional(),
  })
  .strict();
export type DebateOverride = z.infer<typeof DebateOverrideSchema>;

/** 辩论 history 条目：单次发言 */
export const DebateTurnEntrySchema = z.object({
  round: z.number().int().min(1).max(10),
  side: z.enum(['pro', 'con']),
  text: z.string().min(1).max(2000),
});
export type DebateTurnEntry = z.infer<typeof DebateTurnEntrySchema>;

/** 辩论 history：bounded array，挡住客户端撑 token */
export const DebateHistorySchema = z.array(DebateTurnEntrySchema).max(40);

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

/**
 * KV 写路径的可信化校验：服务端在持久化前必须跑这个 ——
 * - 防止客户端塞兆字节 / 注 HTML / 写非法枚举值进 config
 * - z.object 默认 strip，多余字段会被丢，不会落 KV
 * - 失败时只回前 3 条 issue，避免吐整棵 zod 错误树到响应里
 */
export type ValidatedAgentConfig =
  | { kind: 'xuewen'; config: XuewenAgentConfig }
  | { kind: 'debate'; config: DebateAgentConfig }
  | { kind: 'discussion'; config: DiscussionAgentConfig };

export function parseAgentConfig(
  kind: CreateKind,
  raw: unknown,
):
  | { ok: true; data: ValidatedAgentConfig }
  | { ok: false; error: string } {
  const schema =
    kind === 'xuewen'
      ? XuewenAgentSchema
      : kind === 'debate'
        ? DebateAgentSchema
        : DiscussionAgentSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return { ok: false, error: issues || 'config invalid' };
  }
  // TS narrowing：parsed.data 的类型由 schema 决定，按 kind discriminate
  if (kind === 'xuewen') return { ok: true, data: { kind, config: parsed.data as XuewenAgentConfig } };
  if (kind === 'debate') return { ok: true, data: { kind, config: parsed.data as DebateAgentConfig } };
  return { ok: true, data: { kind, config: parsed.data as DiscussionAgentConfig } };
}
