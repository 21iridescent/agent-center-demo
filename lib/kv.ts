import { kv } from '@vercel/kv';
import type { AppRecord } from './types';

const LIST_KEY = 'records:list';
const RECORD_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

/**
 * KV 是否真的可用（生产 Vercel KV / 本地 Upstash 都需要这两个 env）
 * 没配时落到模块级内存兜底——dev 跑 demo 不挂，但 server 重启会丢
 */
const HAS_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const _mem = {
  store: new Map<string, AppRecord>(),
  list: [] as string[],
};

export async function listRecords(limit = 50): Promise<AppRecord[]> {
  if (!HAS_KV) {
    return _mem.list
      .slice(0, limit)
      .map(id => _mem.store.get(id))
      .filter((r): r is AppRecord => !!r);
  }
  const ids = await kv.lrange<string>(LIST_KEY, 0, limit - 1);
  if (!ids?.length) return [];
  const records = await Promise.all(ids.map(id => kv.get<AppRecord>(`record:${id}`)));
  return records.filter((r): r is AppRecord => r !== null && r !== undefined);
}

export async function getRecord(id: string): Promise<AppRecord | null> {
  if (!HAS_KV) return _mem.store.get(id) ?? null;
  const r = await kv.get<AppRecord>(`record:${id}`);
  return r ?? null;
}

export async function createRecord(input: Omit<AppRecord, 'id' | 'createdAt'>): Promise<AppRecord> {
  const id = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = { ...input, id, createdAt: new Date().toISOString() } as AppRecord;
  if (!HAS_KV) {
    _mem.store.set(id, record);
    _mem.list.unshift(id);
    return record;
  }
  await kv.set(`record:${id}`, record, { ex: RECORD_TTL_SEC });
  await kv.lpush(LIST_KEY, id);
  return record;
}

export async function deleteRecord(id: string): Promise<void> {
  if (!HAS_KV) {
    _mem.store.delete(id);
    const i = _mem.list.indexOf(id);
    if (i >= 0) _mem.list.splice(i, 1);
    return;
  }
  await kv.del(`record:${id}`);
  await kv.lrem(LIST_KEY, 0, id);
}
