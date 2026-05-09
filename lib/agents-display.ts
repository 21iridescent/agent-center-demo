import type { AgentType } from '@/components/AgentCard';
import type { SavedAgent } from '@/lib/agent-storage';
import {
  getBackground,
  getXuewenPersonaResolved,
  getTopicThumb,
} from '@/lib/asset-catalog';

/**
 * 智能体卡的展示形状（首页 ② 段 + /agents 全部页共用）。
 *
 * - lastUsed 是人类可读字符串（"昨天" / "上周" / "刚刚"），AgentCard 直接渲染
 * - lastUsedAt / createdAt 是 ISO 字符串，仅用于 /agents 页排序；ISO 8601 字典序==时间序
 *
 * SavedAgent（KV 存储）→ AgentSeed 由 savedToSeed 派生：
 *   lastUsedAt 用 SavedAgent.updatedAt 做代理（edit 也会刷它）
 *   ——后续若引入真"使用打点"endpoint，迁移到独立字段即可
 */
export interface AgentSeed {
  id: string;
  type: AgentType;
  avatar: string;
  /** 学问类：persona 头像 PNG；调用 getXuewenPersonaResolved 拿到 */
  avatarUrl?: string;
  /** 辩论 / 学问类：场景或 topic 封面，作卡片顶部 hero */
  bgUrl?: string;
  name: string;
  subject: string;
  grade: string;
  /** 人类可读："昨天" / "上周" / "刚刚" —— AgentCard 直接渲染这个 */
  lastUsed: string;
  /** ISO 8601 时戳，供 /agents 页排序 */
  lastUsedAt: string;
  /** ISO 8601 时戳，供 /agents 页排序 */
  createdAt: string;
  launchHref: string;
}

const XUEWEN_BG_LAB = getBackground('xuewen', 'science-lab')?.src;
const XUEWEN_BG_NATURAL = getBackground('xuewen', 'natural-history')?.src;
const PLASTIC_THUMB = getTopicThumb('plastic-ocean')?.src;

/**
 * 首页演示种子卡。seed-* id 与 lib/agent-storage.ts 的 SEED_AGENTS 配对，
 * createdAt 与 SEED_AGENTS 同 id 对齐（其中 a1 / a4 是仅前端的 discuss 演示，
 * fabricated 一个更早的 createdAt）。
 *
 * lastUsedAt 反映 lastUsed 人类字符串语义（参考日期 2026-05-09）。
 */
export const INITIAL_AGENTS: AgentSeed[] = [
  {
    id: 'a1',
    type: 'discuss',
    avatar: '水',
    name: '水的三态变化',
    subject: '科学',
    grade: '三年级',
    lastUsed: '昨天',
    lastUsedAt: '2026-05-08T10:00:00.000Z',
    createdAt: '2026-03-20T00:00:00.000Z',
    launchHref: '/legacy/AI思辨使用-讨论-v0.1.html',
  },
  {
    id: 'seed-curie',
    type: 'dialogue',
    avatar: '居',
    avatarUrl: getXuewenPersonaResolved({ personaId: 'curie' }).avatarUrl,
    bgUrl: XUEWEN_BG_LAB,
    name: '居里夫人',
    subject: '科学',
    grade: '五年级',
    lastUsed: '昨天',
    lastUsedAt: '2026-05-08T11:00:00.000Z',
    createdAt: '2026-04-15T00:00:00.000Z',
    launchHref: '/use/xuewen/seed-curie',
  },
  {
    id: 'seed-darwin',
    type: 'dialogue',
    avatar: '达',
    avatarUrl: getXuewenPersonaResolved({ personaId: 'darwin' }).avatarUrl,
    bgUrl: XUEWEN_BG_NATURAL,
    name: '达尔文',
    subject: '科学',
    grade: '六年级',
    lastUsed: '上周',
    lastUsedAt: '2026-05-02T10:00:00.000Z',
    createdAt: '2026-04-20T00:00:00.000Z',
    launchHref: '/use/xuewen/seed-darwin',
  },
  {
    id: 'seed-machine-vision',
    type: 'dialogue',
    avatar: '像',
    avatarUrl: getXuewenPersonaResolved({ personaId: 'socrates' }).avatarUrl,
    bgUrl: XUEWEN_BG_LAB,
    name: '机器视觉博士',
    subject: '人工智能',
    grade: '五年级',
    lastUsed: '3 天前',
    lastUsedAt: '2026-05-06T10:00:00.000Z',
    createdAt: '2026-04-01T00:00:00.000Z',
    launchHref: '/use/xuewen/seed-machine-vision',
  },
  {
    id: 'seed-ai-judgement',
    type: 'debate',
    avatar: '判',
    name: 'AI 该有自己判断吗',
    subject: '人工智能',
    grade: '六年级',
    lastUsed: '上周',
    lastUsedAt: '2026-05-02T11:00:00.000Z',
    createdAt: '2026-04-01T00:00:00.000Z',
    launchHref: '/use/debate/seed-ai-judgement',
  },
  {
    id: 'seed-plastic-ban',
    type: 'debate',
    avatar: '塑',
    bgUrl: PLASTIC_THUMB,
    name: '塑料袋该不该禁用',
    subject: '科学',
    grade: '六年级',
    lastUsed: '4 天前',
    lastUsedAt: '2026-05-05T10:00:00.000Z',
    createdAt: '2026-04-22T00:00:00.000Z',
    launchHref: '/use/debate/seed-plastic-ban',
  },
  {
    id: 'seed-ai-homework',
    type: 'debate',
    avatar: '业',
    name: 'AI 该不该帮写作业',
    subject: '人工智能',
    grade: '五年级',
    lastUsed: '2 天前',
    lastUsedAt: '2026-05-07T10:00:00.000Z',
    createdAt: '2026-04-25T00:00:00.000Z',
    launchHref: '/use/debate/seed-ai-homework',
  },
  {
    id: 'a4',
    type: 'discuss',
    avatar: '磁',
    name: '磁铁的两极',
    subject: '科学',
    grade: '二年级',
    lastUsed: '2 周前',
    lastUsedAt: '2026-04-25T10:00:00.000Z',
    createdAt: '2026-03-25T00:00:00.000Z',
    launchHref: '/legacy/AI思辨使用-讨论-v0.1.html',
  },
];

/** SavedAgent.kind → UI AgentType */
export const KIND_TO_TYPE: Record<string, AgentType> = {
  xuewen: 'dialogue',
  debate: 'debate',
  discussion: 'discuss',
};

/**
 * SavedAgent → 启动 URL
 * - 学问 / 辩论：跳真使用页 /use/{kind}/{id}
 * - 讨论：使用页未实现，仍指 legacy（不破坏卡片）
 */
const SAVED_LAUNCH: Record<string, (id: string) => string> = {
  xuewen: id => `/use/xuewen/${id}`,
  debate: id => `/use/debate/${id}`,
  discussion: () => '/legacy/AI思辨使用-讨论-v0.1.html',
};

export function savedToSeed(a: SavedAgent): AgentSeed {
  const cfg = a.config as Record<string, unknown>;
  const type = KIND_TO_TYPE[a.kind] ?? 'dialogue';
  const name = (cfg.name as string) ?? '未命名';
  const launchFn = SAVED_LAUNCH[a.kind] ?? (() => '/');

  // 从 config 解析视觉资产：xuewen 看 personaId / personaCustom + bgAsset；debate 看 thumbAsset
  let avatarUrl: string | undefined;
  let bgUrl: string | undefined;
  if (a.kind === 'xuewen') {
    const resolved = getXuewenPersonaResolved({
      personaId: cfg.personaId as string | undefined,
      personaCustom: cfg.personaCustom as { avatarUrl: string; roleUrl: string } | undefined,
      name,
    });
    avatarUrl = resolved.avatarUrl;
    // 场景图作衬底（不是人物全身像）—— science-lab / natural-history / classical-academy
    const bg = getBackground('xuewen', cfg.bgAsset as string | undefined);
    bgUrl = bg?.src;
  } else if (a.kind === 'debate') {
    // 只用 topic 封面（plastic-ocean 等），不退到通用 stage-balanced 擂台 ——
    // 通用底图三张同图刷出来反而显得每个辩论都长一样。
    const thumb = getTopicThumb(cfg.thumbAsset as string | undefined);
    bgUrl = thumb?.src;
  }

  return {
    id: a.id,
    type,
    avatar: name.charAt(0),
    avatarUrl,
    bgUrl,
    name,
    subject: (cfg.subject as string) ?? '科学',
    grade: (cfg.grade as string) ?? '一年级',
    lastUsed: '刚刚',
    // updatedAt 做"上次使用"代理：edit 也会刷它，是当前最佳近似
    lastUsedAt: a.updatedAt,
    createdAt: a.createdAt,
    launchHref: launchFn(a.id),
  };
}
