import type { UIMessage } from 'ai';
import { z } from 'zod';

export type PrepKind = 'outline' | 'lesson' | 'exercise' | 'activity' | 'project';

export type RecordType = 'dialogue' | 'debate' | 'discussion' | 'prep';

/* ───────────────────────────────────────────────────────────────
   Transcript payloads — 评价回看的原文存档
   - DialogueTranscript：学问对话，沿用 useChat 的 UIMessage[]
   - DebateTranscript：辩论实录 + 评委文字 + 评分
   字段全部 optional，保护旧记录不挂
   ─────────────────────────────────────────────────────────────── */

export interface DebateTurnEntry {
  round: number;
  side: 'pro' | 'con';
  text: string;
}

export interface DialogueTranscript {
  messages: UIMessage[];
}

export interface DebateTranscript {
  history: DebateTurnEntry[];
  judgeText: string;
  score?: number;
}

/* ───────────────────────────────────────────────────────────────
   Tool-call 副产品 — 备课 agent 接入工具后的留痕
   - Citation：联网搜索 / URL 抓取的引用条目，UI 末尾 panel + 保存归档
   - ToolTraceEntry：调过哪些工具、是否成功；不留 output 全文（output 已写进 markdown）
   ─────────────────────────────────────────────────────────────── */

export interface Citation {
  url: string;
  title: string;
  snippet?: string;
  publishedDate?: string;
}

export interface ToolTraceEntry {
  name: string;          // 'webSearch' | 'crawlUrl' | 'findMisconceptions' | …
  input: unknown;
  ok: boolean;
  ts: string;            // ISO
}

export interface BaseRecord {
  id: string;
  type: RecordType;
  title: string;
  summary: string;
  createdAt: string; // ISO string
  time?: string;     // optional human-readable like "2026-05-08 16:00 · 今天"
  agentName?: string;
  meta?: Record<string, string | undefined>;
  avatar?: string;       // 单字符 fallback（如 'N' / '水'），向后兼容旧数据
  avatarUrl?: string;    // 优先 URL（如 /assets/generated/xuewen-avatar-newton.png），RecordCard 优先用这个
  linkedCourseId?: string; // 关联课程 id（来自 lib/courses.ts COURSE_SEEDS）；undefined 表示未关联。createRecord 据此写 records:byCourse:{id} 反向索引
}

export interface PrepRecord extends BaseRecord {
  type: 'prep';
  kind: PrepKind;
  content?: string;                // full assistant-generated content (markdown source)
  citations?: Citation[];          // web_search / crawl_url 工具产出的引用合集
  toolTrace?: ToolTraceEntry[];    // 工具调用留痕（调了什么/输入/成败/时间）
}

export interface DialogueRecord extends BaseRecord {
  type: 'dialogue';
  turns?: number;
  transcript?: DialogueTranscript;
}

export interface DebateRecord extends BaseRecord {
  type: 'debate';
  pro?: number;
  con?: number;
  score?: number;
  transcript?: DebateTranscript;
}

export interface DiscussionRecord extends BaseRecord {
  type: 'discussion';
  speeches?: number;
  scaffolds?: number;
}

export type AppRecord =
  | PrepRecord
  | DialogueRecord
  | DebateRecord
  | DiscussionRecord;

export const PREP_KIND_LABEL: { [K in PrepKind]: string } = {
  outline: '课件大纲',
  lesson: '教案',
  exercise: '习题',
  activity: '课堂活动',
  project: '项目化学习',
};

export const PREP_KIND_TITLE_SUFFIX: { [K in PrepKind]: string } = {
  outline: '课件大纲',
  lesson: '教案',
  exercise: '练习题',
  activity: '课堂活动方案',
  project: '项目化学习方案',
};

export const PREP_KIND_TO_PATH: { [K in PrepKind]: string } = {
  outline: '/prep/outline',
  lesson: '/prep/lesson',
  exercise: '/prep/exercise',
  activity: '/prep/activity',
  project: '/prep/project',
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/records 写路径可信化校验 schema
   —— 之前 body 是 Omit<AppRecord, 'id'|'createdAt'>，无 Zod 闸，
      客户端能塞兆字节 transcript / 注脚本片段进 summary / content。
      下面按 RecordType 走 discriminated union 做有界校验。
   ═══════════════════════════════════════════════════════════════ */

const PREP_KIND = z.enum(['outline', 'lesson', 'exercise', 'activity', 'project']);

// UIMessage 来自 'ai' 包内部结构复杂，整 schema 写不动；用 unknown + 数组上限挡住主要攻击面
// 单条消息大小由 ai SDK 自带 max-length 约束，再挡住整体条数即可
const BoundedMessages = z.array(z.unknown()).max(200);

const CitationSchema = z.object({
  url: z.string().url().max(500),
  title: z.string().max(300),
  snippet: z.string().max(500).optional(),
  publishedDate: z.string().max(50).optional(),
});

const ToolTraceSchema = z.object({
  name: z.string().max(64),
  input: z.unknown(),
  ok: z.boolean(),
  ts: z.string().max(40),
});

const BaseFields = {
  title: z.string().min(1).max(200),
  summary: z.string().max(500),
  time: z.string().max(80).optional(),
  agentName: z.string().max(80).optional(),
  meta: z.record(z.string(), z.string().optional()).optional(),
  avatar: z.string().max(8).optional(),
  avatarUrl: z.string().max(2000).optional(), // data: URL 头像可能比较长
  linkedCourseId: z.string().max(80).optional(),
};

export const PrepRecordWriteSchema = z.object({
  type: z.literal('prep'),
  ...BaseFields,
  kind: PREP_KIND,
  content: z.string().max(50000).optional(), // 长 markdown，留 50KB 上限
  citations: z.array(CitationSchema).max(50).optional(),
  toolTrace: z.array(ToolTraceSchema).max(100).optional(),
});

export const DialogueRecordWriteSchema = z.object({
  type: z.literal('dialogue'),
  ...BaseFields,
  turns: z.number().int().min(0).max(500).optional(),
  transcript: z
    .object({ messages: BoundedMessages })
    .optional(),
});

export const DebateRecordWriteSchema = z.object({
  type: z.literal('debate'),
  ...BaseFields,
  pro: z.number().min(0).max(10).optional(),
  con: z.number().min(0).max(10).optional(),
  score: z.number().min(0).max(10).optional(),
  transcript: z
    .object({
      history: z.array(
        z.object({
          round: z.number().int().min(1).max(10),
          side: z.enum(['pro', 'con']),
          text: z.string().min(1).max(2000),
        }),
      ).max(40),
      judgeText: z.string().max(8000),
      score: z.number().min(0).max(10).optional(),
    })
    .optional(),
});

export const DiscussionRecordWriteSchema = z.object({
  type: z.literal('discussion'),
  ...BaseFields,
  speeches: z.number().int().min(0).max(500).optional(),
  scaffolds: z.number().int().min(0).max(20).optional(),
});

export const AppRecordWriteSchema = z.discriminatedUnion('type', [
  PrepRecordWriteSchema,
  DialogueRecordWriteSchema,
  DebateRecordWriteSchema,
  DiscussionRecordWriteSchema,
]);

export type AppRecordWriteInput = z.infer<typeof AppRecordWriteSchema>;
