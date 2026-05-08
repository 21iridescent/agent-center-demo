import { notFound } from 'next/navigation';
import { getAgent, SEED_AGENT_IDS } from '@/lib/agent-storage';
import { EditAgentPage } from '@/components/EditAgentPage';

/**
 * /edit/[id] — 智能体直接编辑入口
 *
 * - SSR 取 agent record（KV 真记录或 SEED_AGENTS 兜底，由 getAgent 内部决定）
 * - 不存在 → notFound()
 * - 存在 → 把 agent + isSeed 标记交给客户端 EditAgentPage
 *
 * 这条路由 *没有* AI 对话面板。/create 仍是"用 AI 从零造"入口；本路由是"直接编辑"。
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();
  const isSeed = SEED_AGENT_IDS.has(id);
  return <EditAgentPage agent={agent} isSeed={isSeed} />;
}
