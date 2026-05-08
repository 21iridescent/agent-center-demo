import { NextResponse } from 'next/server';
import { listAgents, createAgent, listHiddenSeedAgentIds } from '@/lib/agent-storage';
import type { CreateKind } from '@/lib/agent-schemas';

export const runtime = 'nodejs';

const VALID_KINDS: CreateKind[] = ['xuewen', 'debate', 'discussion'];

export async function GET() {
  try {
    const [agents, hiddenSeedIds] = await Promise.all([
      listAgents(50),
      listHiddenSeedAgentIds(),
    ]);
    return NextResponse.json({ agents, hiddenSeedIds });
  } catch (e) {
    console.error('list agents failed', e);
    return NextResponse.json(
      { agents: [], hiddenSeedIds: [], error: 'kv_unavailable' },
      { status: 200 },
    );
  }
}

export async function POST(req: Request) {
  let body: { kind?: string; config?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const kind = body.kind as CreateKind | undefined;
  if (!kind || !body.config) {
    return NextResponse.json({ error: 'kind and config required' }, { status: 400 });
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
  }
  try {
    const agent = await createAgent({ kind, config: body.config });
    return NextResponse.json({ agent });
  } catch (e) {
    console.error('create agent failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
