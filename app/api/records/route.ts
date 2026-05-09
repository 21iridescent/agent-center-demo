import { NextResponse } from 'next/server';
import { listRecords, createRecord, listHiddenFallbackRecordIds } from '@/lib/kv';
import { AppRecordWriteSchema } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const [records, hiddenFallbackIds] = await Promise.all([
      listRecords(50),
      listHiddenFallbackRecordIds(),
    ]);
    return NextResponse.json({ records, hiddenFallbackIds });
  } catch (e) {
    console.error('list records failed', e);
    return NextResponse.json(
      { records: [], hiddenFallbackIds: [], error: 'kv_unavailable' },
      { status: 200 },
    );
  }
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  // KV 持久化前必须走 Zod —— 防止任意 payload 落库 / 注入 / 撑爆 storage
  const parsed = AppRecordWriteSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 3)
      .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return NextResponse.json(
      { error: 'invalid_record', detail },
      { status: 400 },
    );
  }
  try {
    const record = await createRecord(parsed.data);
    return NextResponse.json({ record });
  } catch (e) {
    console.error('create record failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
