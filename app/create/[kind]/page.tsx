import { notFound } from 'next/navigation';
import { AgentCreatePage } from '@/components/AgentCreatePage';
import type { CreateKind } from '@/lib/agent-schemas';

const VALID: CreateKind[] = ['xuewen', 'debate', 'discussion'];

export default async function Page({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!VALID.includes(kind as CreateKind)) notFound();
  return <AgentCreatePage kind={kind as CreateKind} />;
}
