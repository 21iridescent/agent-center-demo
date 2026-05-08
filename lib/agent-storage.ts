import { kv } from '@vercel/kv';
import type { CreateKind } from './agent-schemas';

/**
 * 智能体（学问/辩论/讨论）的 KV 存储
 * 无 KV 凭证时落到模块级内存兜底，行为与 lib/kv.ts 对称
 */

const AGENTS_LIST_KEY = 'agents:list';
const AGENTS_HIDDEN_SEEDS_KEY = 'agents:hidden-seeds';
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
type Mem = {
  store: Map<string, SavedAgent>;
  list: string[];
  hiddenSeeds: Set<string>;
};
const _G = globalThis as unknown as { __agentMem?: Mem };
const _mem: Mem =
  _G.__agentMem ??
  (_G.__agentMem = {
    store: new Map<string, SavedAgent>(),
    list: [],
    hiddenSeeds: new Set<string>(),
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
  'seed-curie': {
    id: 'seed-curie',
    kind: 'xuewen',
    config: {
      name: '居里夫人',
      background:
        '波兰裔法国物理学家与化学家，发现镭和钋。语气温和坚定，' +
        '习惯用"我和皮埃尔在棚屋里搅拌沥青铀矿"这类小故事讲发现过程。' +
        '擅长把"看不见的东西怎么被发现"讲成探案，鼓励小学生（尤其女生）相信坚持的力量。' +
        '会反问学生：你怎么确定它真的存在？',
      subject: '科学',
      grade: '五年级',
      personaId: 'curie',
      bgAsset: 'science-lab',
      knowledgeBases: ['教科版五年级科学'],
    },
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
  },
  'seed-darwin': {
    id: 'seed-darwin',
    kind: 'xuewen',
    config: {
      name: '达尔文',
      background:
        '英国博物学家，乘小猎犬号航海五年，写下《物种起源》。' +
        '讲话像在自家书房里翻笔记本，常用"你看这只雀的喙"切入。' +
        '喜欢比较两种相似生物的差别，让学生先注意细节，再去想"为什么不一样"。' +
        '不用"进化论"这种大词，多用"慢慢变得不太一样"。',
      subject: '科学',
      grade: '六年级',
      personaId: 'darwin',
      bgAsset: 'natural-history',
      knowledgeBases: ['教科版六年级科学'],
    },
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  },
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
  'seed-plastic-ban': {
    id: 'seed-plastic-ban',
    kind: 'debate',
    config: {
      name: '塑料袋该不该禁用',
      topic: '一次性塑料袋是否应该禁用',
      background:
        '一次性塑料袋方便买菜、装东西，可它要在自然环境里几百年才会被分解，' +
        '近海塑料垃圾年年增加。一些城市已经开始限塑、禁塑，超市改用纸袋或可重复使用的布袋。' +
        '该不该把"禁用一次性塑料袋"作为一项严格规定，让每一户家庭都跟着调整购物习惯？',
      subject: '科学',
      grade: '六年级',
      proSide: {
        type: 'ai',
        argument: '应该禁用：塑料降解极慢，污染海洋和食物链；早禁早保护环境，可重复使用的替代品已经成熟',
        actorId: 'pro-ai',
      },
      conSide: {
        type: 'human',
        argument: '不该一刀切禁用：塑料袋便宜便利，禁用前要先解决替代品供给和回收，否则反而增加普通家庭负担',
        actorId: 'con-student',
      },
      roundDurationSec: 120,
      totalRounds: 3,
      judgeTemplate: 'default',
      bgAsset: 'stage-balanced',
      thumbAsset: 'plastic-ocean',
    },
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  },
  'seed-ai-homework': {
    id: 'seed-ai-homework',
    kind: 'debate',
    config: {
      name: 'AI 该不该帮写作业',
      topic: '小学生该不该用 AI 帮忙写作业',
      background:
        'AI 工具能在几秒钟内写出一篇作文、解开一道数学题。' +
        '有同学觉得这是"高效学习"，也有家长担心"孩子不再自己思考"。' +
        '小学生在写作业时，到底应不应该让 AI 来帮忙？',
      subject: '人工智能',
      grade: '五年级',
      proSide: {
        type: 'ai',
        argument: '可以用：把 AI 当随身辅导老师，遇到不会的能马上得到讲解，反而能学得更快、更愿意学',
        actorId: 'pro-ai',
      },
      conSide: {
        type: 'human',
        argument: '不应该用：作业是练习思考的过程，AI 直接给答案会让自己的脑子越来越懒，慢慢就不会自己想了',
        actorId: 'con-student',
      },
      roundDurationSec: 120,
      totalRounds: 3,
      judgeTemplate: 'default',
      bgAsset: 'stage-balanced',
    },
    createdAt: '2026-04-25T00:00:00.000Z',
    updatedAt: '2026-04-25T00:00:00.000Z',
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

/**
 * 覆盖式更新已保存（KV 真记录）智能体的 kind + config
 * - 不存在 → 返 null
 * - id 命中 SEED_AGENTS → 返 null（seed 是模块常量，不可写；调用方需走 copy-on-write）
 */
export async function updateAgent(
  id: string,
  input: { kind: CreateKind; config: Record<string, unknown> },
): Promise<SavedAgent | null> {
  if (SEED_AGENTS[id]) return null;
  const now = new Date().toISOString();
  if (!HAS_KV) {
    const existing = _mem.store.get(id);
    if (!existing) return null;
    const next: SavedAgent = {
      ...existing,
      kind: input.kind,
      config: input.config,
      updatedAt: now,
    };
    _mem.store.set(id, next);
    return next;
  }
  const existing = await kv.get<SavedAgent>(`agent:${id}`);
  if (!existing) return null;
  const next: SavedAgent = {
    ...existing,
    kind: input.kind,
    config: input.config,
    updatedAt: now,
  };
  await kv.set(`agent:${id}`, next, { ex: AGENT_TTL_SEC });
  return next;
}

/**
 * Seed 智能体被 copy-on-write 编辑后，把原 seed id 加进隐藏集合
 * 首页据此过滤掉原 seed，避免新副本和 seed 同时显示
 * 镜像 lib/kv.ts 里 records:hidden-fallback 的模式
 */
export async function addHiddenSeedAgentId(id: string): Promise<void> {
  if (!SEED_AGENTS[id]) return; // 不是 seed 不存（防呆）
  if (!HAS_KV) {
    _mem.hiddenSeeds.add(id);
    return;
  }
  await kv.sadd(AGENTS_HIDDEN_SEEDS_KEY, id);
}

export async function listHiddenSeedAgentIds(): Promise<string[]> {
  if (!HAS_KV) return [..._mem.hiddenSeeds];
  const ids = await kv.smembers(AGENTS_HIDDEN_SEEDS_KEY);
  return ids ?? [];
}

/** 一次性导出 seed id 集合给外部判定（client 也用） */
export const SEED_AGENT_IDS: ReadonlySet<string> = new Set(Object.keys(SEED_AGENTS));
