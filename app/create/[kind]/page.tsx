import { notFound } from 'next/navigation';
import { AgentTemplateCreatePage } from '@/components/AgentTemplateCreatePage';
import type { CreateKind } from '@/lib/agent-schemas';

const VALID: CreateKind[] = ['xuewen', 'debate', 'discussion'];

export default async function Page({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!VALID.includes(kind as CreateKind)) notFound();
  return <AgentTemplateCreatePage kind={kind as CreateKind} />;
}
