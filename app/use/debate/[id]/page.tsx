import { notFound } from 'next/navigation';
import { getAgent } from '@/lib/agent-storage';
import { DebateUsePage } from '@/components/DebateUsePage';

/**
 * 辩论使用页 SSR 入口
 * - Next 16 dynamic params 是 Promise，必须 await
 * - kind 不对就 404
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent || agent.kind !== 'debate') notFound();
  return <DebateUsePage agent={agent} />;
}
