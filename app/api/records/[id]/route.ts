import { NextResponse } from 'next/server';
import { getRecord, deleteRecord, addHiddenFallbackRecordId } from '@/lib/kv';
import { FALLBACK_RECORDS } from '@/lib/fallback-records';

export const runtime = 'nodejs';

const FALLBACK_IDS = new Set(FALLBACK_RECORDS.map(r => r.id));

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const record = await getRecord(id);
    if (!record) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ record });
  } catch (e) {
    console.error('get record failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}

/**
 * DELETE 一条记录
 * - id 命中 FALLBACK_RECORDS（硬编码 demo）→ 加进 KV 的 hidden-fallback set，前端按这个 set 隐藏
 * - id 是真 KV 记录 → 物理删除
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    if (FALLBACK_IDS.has(id)) {
      await addHiddenFallbackRecordId(id);
    } else {
      await deleteRecord(id);
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('delete record failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
