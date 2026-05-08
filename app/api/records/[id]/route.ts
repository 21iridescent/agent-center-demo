import { NextResponse } from 'next/server';
import { getRecord, deleteRecord } from '@/lib/kv';

export const runtime = 'nodejs';

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

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await deleteRecord(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('delete record failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
