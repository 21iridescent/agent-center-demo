/**
 * 所有 Agent 的桶导出
 * - PREP_AGENTS：4 个备课工具，无 tools，instructions 即工作描述
 * - unifiedCreateAgent：单一智能体创建 agent，绑 3 个 client-side tool（学问/辩论/讨论），
 *   由 LLM 按对话内容自动路由 — HITL 模式（无 execute）
 */

export { PREP_AGENTS } from './prep';
export { unifiedCreateAgent } from './create-unified';
