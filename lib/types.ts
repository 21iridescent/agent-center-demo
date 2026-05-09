import type { UIMessage } from 'ai';

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
