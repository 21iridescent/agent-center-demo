import { notFound } from 'next/navigation';
import { getAgent } from '@/lib/agent-storage';
import { XuewenUsePage } from '@/components/XuewenUsePage';

/**
 * 学问使用页 SSR 入口
 * - 服务端 getAgent → 404 if 不存在或类型不对
 * - Next 16 dynamic params 是 Promise，必须 await
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent || agent.kind !== 'xuewen') notFound();
  return <XuewenUsePage agent={agent} />;
}
