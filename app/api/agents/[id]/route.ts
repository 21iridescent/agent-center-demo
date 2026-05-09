import { NextResponse } from 'next/server';
import { getAgent, deleteAgent, updateAgent, SEED_AGENT_IDS } from '@/lib/agent-storage';
import { parseAgentConfig, type CreateKind } from '@/lib/agent-schemas';

export const runtime = 'nodejs';

const VALID_KINDS: CreateKind[] = ['xuewen', 'debate', 'discussion'];

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

/**
 * PUT /api/agents/[id] — 覆盖式更新 KV 真记录
 * - id 命中 seed → 409 seed_not_writable（前端走 POST + hide-seed 的 copy-on-write）
 * - id 不存在  → 404
 * - 体型 { kind, config }，与 POST /api/agents 一致
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  if (SEED_AGENT_IDS.has(id)) {
    return NextResponse.json({ error: 'seed_not_writable' }, { status: 409 });
  }
  // KV 持久化前必须走 Zod —— 阻止任意客户端 payload 落库
  const validated = parseAgentConfig(kind, body.config);
  if (!validated.ok) {
    return NextResponse.json(
      { error: 'invalid_config', detail: validated.error },
      { status: 400 },
    );
  }
  try {
    const agent = await updateAgent(id, {
      kind,
      config: validated.data.config as Record<string, unknown>,
    });
    if (!agent) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ agent });
  } catch (e) {
    console.error('update agent failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
