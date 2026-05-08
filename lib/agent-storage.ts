import { kv } from '@vercel/kv';
import type { CreateKind } from './agent-schemas';

/**
 * 智能体（学问/辩论/讨论）的 KV 存储
 * 无 KV 凭证时落到模块级内存兜底，行为与 lib/kv.ts 对称
 */

const AGENTS_LIST_KEY = 'agents:list';
const AGENT_TTL_SEC = 60 * 60 * 24 * 90; // 90 days

const HAS_KV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export interface SavedAgent {
  id: string;
  kind: CreateKind;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const _mem = {
  store: new Map<string, SavedAgent>(),
  list: [] as string[],
};

export async function listAgents(limit = 50): Promise<SavedAgent[]> {
  if (!HAS_KV) {
    return _mem.list
      .slice(0, limit)
      .map(id => _mem.store.get(id))
      .filter((r): r is SavedAgent => !!r);
  }
  const ids = await kv.lrange<string>(AGENTS_LIST_KEY, 0, limit - 1);
  if (!ids?.length) return [];
  const items = await Promise.all(ids.map(id => kv.get<SavedAgent>(`agent:${id}`)));
  return items.filter((r): r is SavedAgent => r !== null && r !== undefined);
}

export async function getAgent(id: string): Promise<SavedAgent | null> {
  if (!HAS_KV) return _mem.store.get(id) ?? null;
  const r = await kv.get<SavedAgent>(`agent:${id}`);
  return r ?? null;
}

export async function createAgent(input: {
  kind: CreateKind;
  config: Record<string, unknown>;
}): Promise<SavedAgent> {
  const id = `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const agent: SavedAgent = { id, ...input, createdAt: now, updatedAt: now };
  if (!HAS_KV) {
    _mem.store.set(id, agent);
    _mem.list.unshift(id);
    return agent;
  }
  await kv.set(`agent:${id}`, agent, { ex: AGENT_TTL_SEC });
  await kv.lpush(AGENTS_LIST_KEY, id);
  return agent;
}

export async function deleteAgent(id: string): Promise<void> {
  if (!HAS_KV) {
    _mem.store.delete(id);
    const i = _mem.list.indexOf(id);
    if (i >= 0) _mem.list.splice(i, 1);
    return;
  }
  await kv.del(`agent:${id}`);
  await kv.lrem(AGENTS_LIST_KEY, 0, id);
}
