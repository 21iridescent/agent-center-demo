import { kv } from '@vercel/kv';
import type { AppRecord } from './types';

const LIST_KEY = 'records:list';
const HIDDEN_FALLBACK_KEY = 'records:hidden-fallback';
const BY_COURSE_KEY_PREFIX = 'records:byCourse:'; // Set per课程，存 record id 集合（保存关联关系；视图未实现）
const RECORD_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

/**
 * KV 是否真的可用（生产 Vercel KV / 本地 Upstash 都需要这两个 env）
 * 没配时落到模块级内存兜底——dev 跑 demo 不挂，但 server 重启会丢
 */
const HAS_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const _mem = {
  store: new Map<string, AppRecord>(),
  list: [] as string[],
  hiddenFallback: new Set<string>(),
  byCourse: new Map<string, Set<string>>(), // courseId → Set<recordId>，与远端 records:byCourse:{id} 平行
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
  const courseId = record.linkedCourseId;
  if (!HAS_KV) {
    _mem.store.set(id, record);
    _mem.list.unshift(id);
    if (courseId) {
      let set = _mem.byCourse.get(courseId);
      if (!set) { set = new Set(); _mem.byCourse.set(courseId, set); }
      set.add(id);
    }
    return record;
  }
  await kv.set(`record:${id}`, record, { ex: RECORD_TTL_SEC });
  await kv.lpush(LIST_KEY, id);
  if (courseId) {
    await kv.sadd(`${BY_COURSE_KEY_PREFIX}${courseId}`, id);
  }
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

/**
 * FALLBACK_RECORDS（lib/fallback-records.ts 硬编码 demo）的"已隐藏" id 集合
 * 真 KV 记录走 deleteRecord 物理删除；FALLBACK 删不掉（在源码里），只能记一份"已删"列表
 * 用 Vercel KV Set（sadd/smembers），跨设备一致
 */
export async function addHiddenFallbackRecordId(id: string): Promise<void> {
  if (!HAS_KV) {
    _mem.hiddenFallback.add(id);
    return;
  }
  await kv.sadd(HIDDEN_FALLBACK_KEY, id);
}

export async function listHiddenFallbackRecordIds(): Promise<string[]> {
  if (!HAS_KV) {
    return [..._mem.hiddenFallback];
  }
  const ids = await kv.smembers(HIDDEN_FALLBACK_KEY);
  return ids ?? [];
}
