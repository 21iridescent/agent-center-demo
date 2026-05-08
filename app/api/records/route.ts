import { NextResponse } from 'next/server';
import { listRecords, createRecord, listHiddenFallbackRecordIds } from '@/lib/kv';
import type { AppRecord } from '@/lib/types';

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
  let body: Omit<AppRecord, 'id' | 'createdAt'>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.type || !body.title) {
    return NextResponse.json({ error: 'type and title required' }, { status: 400 });
  }
  try {
    const record = await createRecord(body);
    return NextResponse.json({ record });
  } catch (e) {
    console.error('create record failed', e);
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
