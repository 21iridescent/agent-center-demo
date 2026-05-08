/**
 * 智能体素材目录 — 单一真源
 *
 * 39 张 PNG + asset-manifest.json 物理放在 public/assets/generated/
 * 这里按 (kind, slot) 分组导出 — schema enum / picker 候选 / HITL prompt enum / 使用页 <img> 都从这里取
 *
 * 设计要点：
 * 1. PERSONAS 用 personaId 单字段，每条同时含 avatar (头像 512×512) 和 role (全身像 1024×1536)
 *    —— 头像和全身像是同一人物的两张图，物理绑定，不分两个字段
 * 2. BACKGROUNDS 按 kind 分（xuewen/debate/discussion），独立选场景
 * 3. DEBATE_ACTORS 4 选 1，含 side (pro/con) + kind (ai/human) 联动
 * 4. TOPIC_THUMBS 辩论话题封面，可选
 * 5. 所有 src 都是 / 开头的 public 路径，前端可直接 <img src={...}>
 */

// ─────────────────────────────────────────────────────────────
// 学问 · 6 个虚拟人物
// ─────────────────────────────────────────────────────────────

export interface Persona {
  id: string;
  label: string;
  blurb: string;
  avatar: string;
  role: string;
}

export const PERSONAS = {
  xuewen: [
    {
      id: 'newton',
      label: '牛顿',
      blurb: '经典力学 · 万有引力',
      avatar: '/assets/generated/xuewen-avatar-newton.png',
      role:   '/assets/generated/xuewen-role-newton.png',
    },
    {
      id: 'curie',
      label: '居里夫人',
      blurb: '放射性研究 · 两次诺奖',
      avatar: '/assets/generated/xuewen-avatar-curie.png',
      role:   '/assets/generated/xuewen-role-curie.png',
    },
    {
      id: 'darwin',
      label: '达尔文',
      blurb: '物种起源 · 自然选择',
      avatar: '/assets/generated/xuewen-avatar-darwin.png',
      role:   '/assets/generated/xuewen-role-darwin.png',
    },
    {
      id: 'socrates',
      label: '苏格拉底',
      blurb: '提问思辨 · 古希腊哲学',
      avatar: '/assets/generated/xuewen-avatar-socrates.png',
      role:   '/assets/generated/xuewen-role-socrates.png',
    },
    {
      id: 'galileo',
      label: '伽利略',
      blurb: '天文观测 · 近代科学奠基',
      avatar: '/assets/generated/xuewen-avatar-galileo.png',
      role:   '/assets/generated/xuewen-role-galileo.png',
    },
    {
      id: 'tong-dizhou',
      label: '童第周',
      blurb: '中国实验胚胎学',
      avatar: '/assets/generated/xuewen-avatar-tong-dizhou.png',
      role:   '/assets/generated/xuewen-role-tong-dizhou.png',
    },
    {
      id: 'custom-li',
      label: '自定义角色',
      blurb: '由教师上传',
      avatar: '/assets/generated/xuewen-avatar-custom-li.png',
      role:   '/assets/generated/xuewen-role-custom-li.png',
    },
  ],
} as const satisfies Record<'xuewen', readonly Persona[]>;

export type XuewenPersonaId = (typeof PERSONAS.xuewen)[number]['id'];

// ─────────────────────────────────────────────────────────────
// 背景图 · 按 kind 分
// ─────────────────────────────────────────────────────────────

export interface Background {
  id: string;
  label: string;
  hint?: string;
  src: string;
}

export const BACKGROUNDS = {
  xuewen: [
    {
      id: 'classical-academy',
      label: '古典书院',
      hint: '适合人文 / 历史背景的角色',
      src: '/assets/generated/xuewen-bg-classical-academy.png',
    },
    {
      id: 'science-lab',
      label: '科学实验室',
      hint: '默认 · 适合大多数角色',
      src: '/assets/generated/xuewen-bg-science-lab.png',
    },
    {
      id: 'natural-history',
      label: '自然博物',
      hint: '适合生物 / 进化主题',
      src: '/assets/generated/xuewen-bg-natural-history.png',
    },
  ],
  debate: [
    {
      id: 'stage-balanced',
      label: '平衡擂台',
      src: '/assets/generated/debate-bg-stage-balanced.png',
    },
  ],
  discussion: [
    {
      id: 'classroom-roundtable',
      label: '圆桌教室',
      src: '/assets/generated/discussion-bg-classroom-roundtable.png',
    },
  ],
} as const satisfies Record<string, readonly Background[]>;

export type XuewenBgId = (typeof BACKGROUNDS.xuewen)[number]['id'];
export type DebateBgId = (typeof BACKGROUNDS.debate)[number]['id'];
export type DiscussionBgId = (typeof BACKGROUNDS.discussion)[number]['id'];

// ─────────────────────────────────────────────────────────────
// 辩论 · 4 个辩手全身像
// ─────────────────────────────────────────────────────────────

export interface DebateActor {
  id: string;
  side: 'pro' | 'con';
  kind: 'ai' | 'human';
  label: string;
  role: string;
}

export const DEBATE_ACTORS = [
  {
    id: 'pro-ai',
    side: 'pro',
    kind: 'ai',
    label: '正方 · AI',
    role: '/assets/generated/debate-role-pro-ai.png',
  },
  {
    id: 'con-ai',
    side: 'con',
    kind: 'ai',
    label: '反方 · AI',
    role: '/assets/generated/debate-role-con-ai.png',
  },
  {
    id: 'pro-student',
    side: 'pro',
    kind: 'human',
    label: '正方 · 学生',
    role: '/assets/generated/debate-role-pro-student.png',
  },
  {
    id: 'con-student',
    side: 'con',
    kind: 'human',
    label: '反方 · 学生',
    role: '/assets/generated/debate-role-con-student.png',
  },
] as const satisfies readonly DebateActor[];

export type DebateActorId = (typeof DEBATE_ACTORS)[number]['id'];

export const DEBATE_JUDGE_AVATAR = '/assets/generated/debate-avatar-judge.png';

// ─────────────────────────────────────────────────────────────
// 辩论 · 话题封面（可选）
// ─────────────────────────────────────────────────────────────

export interface TopicThumb {
  id: string;
  label: string;
  src: string;
}

export const TOPIC_THUMBS = [
  { id: 'plastic-ocean',           label: '塑料海洋',     src: '/assets/generated/debate-thumb-plastic-ocean.png' },
  { id: 'biodegradable',           label: '生物降解',     src: '/assets/generated/debate-thumb-biodegradable.png' },
  { id: 'plastic-lifecycle',       label: '塑料生命周期', src: '/assets/generated/debate-material-plastic-lifecycle.png' },
  { id: 'ocean-data-board',        label: '海洋数据',     src: '/assets/generated/debate-material-ocean-data-board.png' },
  { id: 'biodegradation-experiment', label: '降解实验',   src: '/assets/generated/debate-material-biodegradation-experiment.png' },
  { id: 'policy-brief',            label: '政策简报',     src: '/assets/generated/debate-material-policy-brief.png' },
  { id: 'school-recycling-case',   label: '校园回收案例', src: '/assets/generated/debate-material-school-recycling-case.png' },
  { id: 'news-report',             label: '新闻报道',     src: '/assets/generated/debate-material-news-report.png' },
  { id: 'argument-cards',          label: '论点卡片',     src: '/assets/generated/debate-material-argument-cards.png' },
  { id: 'stakeholder-map',         label: '利益相关方',   src: '/assets/generated/debate-material-stakeholder-map.png' },
] as const satisfies readonly TopicThumb[];

export type TopicThumbId = (typeof TOPIC_THUMBS)[number]['id'];

// ─────────────────────────────────────────────────────────────
// 讨论 · host + 学生头像 — 占位未生成
// ─────────────────────────────────────────────────────────────
// manifest.json 中 placeholder=true 的 7 张（host + role + student-a~f）
// 物理文件还没出，本期使用页只做学问/辩论，不引用，避免 404
// 未来出图后再补回 catalog

// ─────────────────────────────────────────────────────────────
// Helpers — 找不到时返回 undefined，调用方自己 fallback
// ─────────────────────────────────────────────────────────────

export function getXuewenPersona(id: string | undefined) {
  if (!id) return undefined;
  return PERSONAS.xuewen.find(p => p.id === id);
}

export interface ResolvedPersona {
  avatarUrl?: string;
  roleUrl?: string;
  label?: string;
  /** catalog 命中时为对应 id；走 personaCustom 时为 undefined */
  personaId?: string;
}

/**
 * 学问人物形象解析 — catalog 优先，personaCustom 兜底
 * 同时存在以 personaId 为准（schema describe 也明示）
 */
export function getXuewenPersonaResolved(cfg: {
  personaId?: string;
  personaCustom?: { avatarUrl: string; roleUrl: string };
  name?: string;
}): ResolvedPersona {
  if (cfg.personaId) {
    const p = getXuewenPersona(cfg.personaId);
    if (p) {
      return {
        avatarUrl: p.avatar,
        roleUrl: p.role,
        label: p.label,
        personaId: p.id,
      };
    }
  }
  if (cfg.personaCustom) {
    return {
      avatarUrl: cfg.personaCustom.avatarUrl,
      roleUrl: cfg.personaCustom.roleUrl,
      label: cfg.name,
    };
  }
  return {};
}

export function getBackground(kind: keyof typeof BACKGROUNDS, id: string | undefined) {
  if (!id) return undefined;
  return BACKGROUNDS[kind].find(b => b.id === id);
}

export function getDebateActor(id: string | undefined) {
  if (!id) return undefined;
  return DEBATE_ACTORS.find(a => a.id === id);
}

export function getTopicThumb(id: string | undefined) {
  if (!id) return undefined;
  return TOPIC_THUMBS.find(t => t.id === id);
}

// 派生 zod enum tuples — schema 用
// 注意：z.enum 要求 [string, ...string[]]，所以 as cast 一下确保 TS 认非空
export const XUEWEN_PERSONA_IDS = PERSONAS.xuewen.map(p => p.id) as [
  XuewenPersonaId,
  ...XuewenPersonaId[],
];
export const XUEWEN_BG_IDS = BACKGROUNDS.xuewen.map(b => b.id) as [
  XuewenBgId,
  ...XuewenBgId[],
];
export const DEBATE_BG_IDS = BACKGROUNDS.debate.map(b => b.id) as [
  DebateBgId,
  ...DebateBgId[],
];
export const DISCUSSION_BG_IDS = BACKGROUNDS.discussion.map(b => b.id) as [
  DiscussionBgId,
  ...DiscussionBgId[],
];
export const DEBATE_ACTOR_IDS = DEBATE_ACTORS.map(a => a.id) as [
  DebateActorId,
  ...DebateActorId[],
];
export const TOPIC_THUMB_IDS = TOPIC_THUMBS.map(t => t.id) as [
  TopicThumbId,
  ...TopicThumbId[],
];
