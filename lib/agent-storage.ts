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

/**
 * 内存兜底：钉到 globalThis 上，跨 Next.js dev module 实例共享
 *
 * 为什么不能用模块级 const：Turbopack（Next 16 dev）会把 SSR page 和 API
 * route 编进不同 bundle，模块各持一份 _mem。POST /api/agents 写到实例 A，
 * SSR getAgent 读实例 B 永远为空 → /use/{kind}/{id} 必 404。
 * 钉到 globalThis 是 Next.js 推荐的 dev singleton 模式（Prisma client 同款）。
 */
type Mem = { store: Map<string, SavedAgent>; list: string[] };
const _G = globalThis as unknown as { __agentMem?: Mem };
const _mem: Mem =
  _G.__agentMem ??
  (_G.__agentMem = {
    store: new Map<string, SavedAgent>(),
    list: [],
  });

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
  if (!HAS_KV) return _mem.store.get(id) ?? SEED_AGENTS[id] ?? null;
  const r = await kv.get<SavedAgent>(`agent:${id}`);
  return r ?? SEED_AGENTS[id] ?? null;
}

/**
 * 内置 demo 种子智能体 — 让首页 4 张演示卡也能跳真使用页跑真 AI
 *
 * 当 SSR `getAgent(id)` 在 KV 和 mem 里都找不到时，降级到这里。
 * 只覆盖 学问 / 辩论 两个类型 — 讨论本期没真使用页，仍指 legacy。
 */
const SEED_AGENTS: Record<string, SavedAgent> = {
  'seed-machine-vision': {
    id: 'seed-machine-vision',
    kind: 'xuewen',
    config: {
      name: '机器视觉博士',
      background:
        '人工智能图像识别领域的虚拟博士，擅长用比喻给小学生讲解机器如何"看"图像。' +
        '说话耐心、爱举生活例子（比如用积木形状辨认、用拼图比方），' +
        '专长：卷积、特征提取、图像分类的小学生友好讲解。会反问学生引导思考。',
      subject: '人工智能',
      grade: '五年级',
      personaId: 'socrates',
      bgAsset: 'science-lab',
      knowledgeBases: ['人教版五年级人工智能·图像篇'],
    },
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  'seed-ai-judgement': {
    id: 'seed-ai-judgement',
    kind: 'debate',
    config: {
      name: 'AI 该有自己判断吗',
      topic: 'AI 该不该有自己的判断',
      background:
        '随着 AI 越来越能干，它该不该在被人指挥时拥有自己的"判断力"——比如能否拒绝不合理指令？' +
        '这关系到我们如何信任和使用 AI。',
      subject: '人工智能',
      grade: '六年级',
      proSide: {
        type: 'ai',
        argument: 'AI 应该有自己判断，否则容易被坏人滥用做坏事；它判断对了能保护更多人',
        actorId: 'pro-ai',
      },
      conSide: {
        type: 'human',
        argument: 'AI 不该有自己判断；它的判断可能错且没人负责，应该完全听人的',
        actorId: 'con-student',
      },
      roundDurationSec: 120,
      totalRounds: 3,
      judgeTemplate: 'default',
      bgAsset: 'stage-balanced',
    },
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
};

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
