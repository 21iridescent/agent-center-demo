export type PrepKind = 'outline' | 'lesson' | 'exercise' | 'activity';

export type RecordType = 'dialogue' | 'debate' | 'discussion' | 'prep';

export interface BaseRecord {
  id: string;
  type: RecordType;
  title: string;
  summary: string;
  createdAt: string; // ISO string
  time?: string;     // optional human-readable like "2026-05-08 16:00 · 今天"
  agentName?: string;
  meta?: Record<string, string | undefined>;
  avatar?: string;
}

export interface PrepRecord extends BaseRecord {
  type: 'prep';
  kind: PrepKind;
  content?: string; // full assistant-generated content
}

export interface DialogueRecord extends BaseRecord {
  type: 'dialogue';
  turns?: number;
}

export interface DebateRecord extends BaseRecord {
  type: 'debate';
  pro?: number;
  con?: number;
  score?: number;
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
};

export const PREP_KIND_TITLE_SUFFIX: { [K in PrepKind]: string } = {
  outline: '课件大纲',
  lesson: '教案',
  exercise: '练习题',
  activity: '课堂活动方案',
};

export const PREP_KIND_TO_PATH: { [K in PrepKind]: string } = {
  outline: '/prep/outline',
  lesson: '/prep/lesson',
  exercise: '/prep/exercise',
  activity: '/prep/activity',
};
