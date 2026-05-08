import { kv } from '@vercel/kv';
import type { AppRecord } from './types';

const LIST_KEY = 'records:list';
const RECORD_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export async function listRecords(limit = 50): Promise<AppRecord[]> {
  const ids = await kv.lrange<string>(LIST_KEY, 0, limit - 1);
  if (!ids?.length) return [];
  const records = await Promise.all(ids.map(id => kv.get<AppRecord>(`record:${id}`)));
  return records.filter((r): r is AppRecord => r !== null && r !== undefined);
}

export async function getRecord(id: string): Promise<AppRecord | null> {
  const r = await kv.get<AppRecord>(`record:${id}`);
  return r ?? null;
}

export async function createRecord(input: Omit<AppRecord, 'id' | 'createdAt'>): Promise<AppRecord> {
  const id = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = { ...input, id, createdAt: new Date().toISOString() } as AppRecord;
  await kv.set(`record:${id}`, record, { ex: RECORD_TTL_SEC });
  await kv.lpush(LIST_KEY, id);
  return record;
}

export async function deleteRecord(id: string): Promise<void> {
  await kv.del(`record:${id}`);
  await kv.lrem(LIST_KEY, 0, id);
}
