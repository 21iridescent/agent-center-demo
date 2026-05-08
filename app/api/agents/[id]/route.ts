import { NextResponse } from 'next/server';
import { getAgent, deleteAgent } from '@/lib/agent-storage';

export const runtime = 'nodejs';

/**
 * GET /api/agents/[id] — 单读保存的智能体
 * 使用页（SSR）会调这个接口取 agent.config 渲染
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const agent = await getAgent(id);
    if (!agent) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ agent });
  } catch (e) {
    console.error('get agent failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}

/**
 * DELETE /api/agents/[id] — 删保存的智能体
 * 首页 confirmDelete 用；KV 兜底/真 KV 都支持（lib/agent-storage 已实现）
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteAgent(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('delete agent failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
