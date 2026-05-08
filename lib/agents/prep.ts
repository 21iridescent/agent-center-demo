import { ToolLoopAgent } from 'ai';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';
import {
  OUTLINE_PROMPT,
  LESSON_PROMPT,
  EXERCISE_PROMPT,
  ACTIVITY_PROMPT,
} from '@/lib/prep-prompts';
import type { PrepKind } from '@/lib/types';

/**
 * 4 个备课工具的 Agent
 * 每个 agent 没有 tools — 与纯 streamText 等价，但与 Phase 2 共享同一抽象
 * instructions 来自 lib/prep-prompts.ts（保留作为提示词单一真源）
 */

export const outlineAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: OUTLINE_PROMPT,
  temperature: 0.7,
});

export const lessonAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: LESSON_PROMPT,
  temperature: 0.7,
});

export const exerciseAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: EXERCISE_PROMPT,
  temperature: 0.7,
});

export const activityAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: ACTIVITY_PROMPT,
  temperature: 0.7,
});

export const PREP_AGENTS: Record<PrepKind, ToolLoopAgent> = {
  outline: outlineAgent,
  lesson: lessonAgent,
  exercise: exerciseAgent,
  activity: activityAgent,
};
