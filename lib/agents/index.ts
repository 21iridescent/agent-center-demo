/**
 * 所有 Agent 的桶导出
 * - PREP_AGENTS：4 个备课工具（无 tools）
 * - unifiedCreateAgent：单一 ToolLoopAgent + 3 个 client-side tool；用于 /create 对话式入口
 *   （LLM 按对话内容自动路由）
 * - CREATE_AGENTS：3 个 per-kind ToolLoopAgent；用于 /create/[kind] 模板入口
 *   （已确定 kind，单 tool，更可控）
 */

export { PREP_AGENTS } from './prep';
export { unifiedCreateAgent } from './create-unified';

import { createXuewenAgent } from './create-xuewen';
import { createDebateAgent } from './create-debate';
import { createDiscussionAgent } from './create-discussion';
import type { CreateKind } from '@/lib/agent-schemas';

export const CREATE_AGENTS = {
  xuewen: createXuewenAgent,
  debate: createDebateAgent,
  discussion: createDiscussionAgent,
} satisfies Record<CreateKind, unknown>;
