import { ToolLoopAgent, stepCountIs } from 'ai';
import { deepseek, DEEPSEEK_MODEL, QUALITY_OPTS } from '@/lib/deepseek';
import {
  OUTLINE_PROMPT,
  LESSON_PROMPT,
  EXERCISE_PROMPT,
  ACTIVITY_PROMPT,
  PROJECT_PROMPT,
} from '@/lib/prep-prompts';
import {
  OUTLINE_TOOLS,
  LESSON_TOOLS,
  EXERCISE_TOOLS,
  ACTIVITY_TOOLS,
  PROJECT_TOOLS,
} from '@/lib/tools';
import type { PrepKind } from '@/lib/types';

/**
 * 4 个备课工具的 ToolLoopAgent
 * - 每个 agent 装载 lib/tools/index.ts 里它对应的子集（不全量；选择困难）
 * - stopWhen: stepCountIs(8) — 多步循环上限
 * - QUALITY_OPTS（reasoningEffort: high + thinking enabled）按 deepseek.ts 的 per-route 预设
 *
 * 路由层 (app/api/generate/route.ts) 会把 contextFields + params 拼成
 * "## 当前备课上下文" 段落 prepend 到 instructions 上。
 */

export const outlineAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: OUTLINE_PROMPT,
  temperature: 0.7,
  tools: OUTLINE_TOOLS,
  stopWhen: stepCountIs(8),
  ...QUALITY_OPTS,
});

export const lessonAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: LESSON_PROMPT,
  temperature: 0.7,
  tools: LESSON_TOOLS,
  stopWhen: stepCountIs(8),
  ...QUALITY_OPTS,
});

export const exerciseAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: EXERCISE_PROMPT,
  temperature: 0.7,
  tools: EXERCISE_TOOLS,
  stopWhen: stepCountIs(8),
  ...QUALITY_OPTS,
});

export const activityAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: ACTIVITY_PROMPT,
  temperature: 0.7,
  tools: ACTIVITY_TOOLS,
  stopWhen: stepCountIs(8),
  ...QUALITY_OPTS,
});

export const projectAgent = new ToolLoopAgent({
  model: deepseek.chat(DEEPSEEK_MODEL),
  instructions: PROJECT_PROMPT,
  temperature: 0.7,
  tools: PROJECT_TOOLS,
  stopWhen: stepCountIs(8),
  ...QUALITY_OPTS,
});

// 不同 agent 装载的 TOOLS 类型签名各不相同（TOOLS 是 invariant 泛型），
// 用 `satisfies Record<PrepKind, unknown>` 验证键齐全 + 保留每个 agent 的精确类型，
// 不强求统一类型。route 层 createAgentUIStreamResponse 通过 generic 推断接受任意 Agent。
export const PREP_AGENTS = {
  outline: outlineAgent,
  lesson: lessonAgent,
  exercise: exerciseAgent,
  activity: activityAgent,
  project: projectAgent,
} as const satisfies Record<PrepKind, unknown>;
