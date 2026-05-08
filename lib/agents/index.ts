/**
 * 所有 Agent 的桶导出
 * - PREP_AGENTS：4 个备课工具，无 tools，instructions 即工作描述
 * - CREATE_AGENTS：3 个智能体对话式创建（学问/辩论/讨论），各自带 1 个 client-side tool（HITL）
 * 路由层只 import 这一个文件
 *
 * 注：刻意不给 CREATE_AGENTS 标 Record<CreateKind, ToolLoopAgent<...>> —— 每个 agent 的
 * tool inputSchema 不同，强行收窄到 Record<string, unknown> 会触发 ToolLoopAgent 的
 * contravariant 位置（onStepFinish）类型不匹配。用 satisfies 保 key 安全 + 让 TS 推具体类型。
 */

export { PREP_AGENTS } from './prep';
import { createXuewenAgent } from './create-xuewen';
import { createDebateAgent } from './create-debate';
import { createDiscussionAgent } from './create-discussion';
import type { CreateKind } from '@/lib/agent-schemas';

export const CREATE_AGENTS = {
  xuewen: createXuewenAgent,
  debate: createDebateAgent,
  discussion: createDiscussionAgent,
} satisfies Record<CreateKind, unknown>;
