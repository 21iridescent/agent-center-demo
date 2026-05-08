import { NextResponse } from 'next/server';
import { addHiddenSeedAgentId, SEED_AGENT_IDS } from '@/lib/agent-storage';

export const runtime = 'nodejs';

/**
 * POST /api/agents/[id]/hide-seed
 * - 把 seed id 加进 KV 'agents:hidden-seeds' 集合
 * - 用于 EditAgentPage 编辑 seed 时的 copy-on-write 收尾：
 *     先 POST /api/agents 创建副本，再 POST 这条让原 seed 从首页消失
 * - 仅 seed id 有效；非 seed id → 400
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!SEED_AGENT_IDS.has(id)) {
    return NextResponse.json({ error: 'not_a_seed' }, { status: 400 });
  }
  try {
    await addHiddenSeedAgentId(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('hide-seed failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
