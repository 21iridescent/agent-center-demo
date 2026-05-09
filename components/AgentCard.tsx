'use client';

import Link from 'next/link';

const TYPE_LABEL = {
  dialogue: 'AI 学问',
  debate: 'AI 辩论',
  discuss: 'AI 讨论',
} as const;

const TYPE_TOKENS = {
  dialogue: {
    bg:   'var(--color-type-dialogue-bg)',
    fg:   'var(--color-type-dialogue)',
    deep: 'var(--color-type-dialogue-deep)',
    edge: 'var(--color-type-dialogue)',
  },
  debate: {
    bg:   'var(--color-type-debate-bg)',
    fg:   'var(--color-type-debate)',
    deep: 'var(--color-type-debate-deep)',
    edge: 'var(--color-type-debate)',
  },
  discuss: {
    bg:   'var(--color-type-discussion-bg)',
    fg:   'var(--color-type-discussion)',
    deep: 'var(--color-type-discussion-deep)',
    edge: 'var(--color-type-discussion)',
  },
} as const;

export type AgentType = keyof typeof TYPE_LABEL;

interface Props {
  type: AgentType;
  avatar: string;
  /** 真人头像 URL（学问类的 personaId 解析出来的图）。优先于 avatar 字 */
  avatarUrl?: string;
  /** 卡片顶部 hero 图（辩论类用 thumbAsset 解析出来的图） */
  bgUrl?: string;
  name: string;
  subject: string;
  grade: string;
  /**
   * 副标行 —— 一句话告诉老师"这是个什么"：
   * xuewen=人物简介首句 / debate=辩题 / discuss=讨论主题
   */
  description?: string;
  /**
   * 评价维度（最多 5 条上屏，多余 "+N" 收）—— 辩论 / 讨论卡片露出来，
   * 让老师选卡时直接看到学生会被按哪些维度评分。
   */
  evalDimensions?: string[];
  lastUsed: string;
  launchHref: string;
  editHref: string;
  manageMode: boolean;
  onDelete: () => void;
}

/**
 * 智能体卡片 · library catalog card
 * - 物理纸卡：1px paper-edge 框 + paper-card 底 + 极轻 shadow-sm（不浮起）
 * - 顶部一条 type-color 章式横条（4px），是这张卡的"分类标签"
 * - hover 时整卡微微抬升（shadow-pop），不是把背景变白
 */
export function AgentCard({
  type,
  avatar,
  avatarUrl,
  bgUrl,
  name,
  subject,
  grade,
  description,
  evalDimensions,
  lastUsed,
  launchHref,
  editHref,
  manageMode,
  onDelete,
}: Props) {
  const t = TYPE_TOKENS[type];
  const showDims = (type === 'debate' || type === 'discuss') && evalDimensions && evalDimensions.length > 0;
  const dimsHead = showDims ? evalDimensions!.slice(0, 4) : [];
  const dimsRest = showDims ? evalDimensions!.length - dimsHead.length : 0;

  // bgUrl 时 → 整张卡作为背景，不抽出 hero 条目（不变化卡片高度）。
  // 用 paper-card 半透明 overlay 压住图，让正文 ink-1 文字仍然清晰可读。
  // color-mix 走 srgb 把 paper-card 当 base + 84% alpha，剩 16% 让图透出来。
  const cardBackground = bgUrl
    ? `linear-gradient(
         color-mix(in srgb, var(--color-paper-card) 84%, transparent),
         color-mix(in srgb, var(--color-paper-card) 84%, transparent)
       ), url(${bgUrl}) center/cover no-repeat`
    : 'var(--color-paper-card)';

  return (
    <article
      className="group relative flex flex-col overflow-hidden border transition-all duration-200 hover:[box-shadow:var(--shadow-pop)]"
      style={{
        borderColor: 'var(--color-paper-edge)',
        background: cardBackground,
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* 顶部 type 章式横条 — 4px 通栏 */}
      <span
        aria-hidden
        className="block h-[4px] w-full"
        style={{ background: t.edge }}
      />

      <div className="relative flex flex-col gap-3 px-5 pt-4 pb-3">
        {/* 头部 · 方形头像章 + 标题 + smcp type label */}
        <div className="flex items-start gap-3">
          <span
            className="font-numeric flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden text-[16px] font-bold"
            style={{
              background: avatarUrl ? 'transparent' : t.bg,
              color: t.deep,
              borderRadius: 'var(--radius-xs)',
            }}
            aria-hidden
          >
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt={name}
                width={44}
                height={44}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              avatar
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3
              className="font-display truncate text-[18px] font-medium leading-tight"
              style={{ color: 'var(--color-ink-1)' }}
            >
              {name}
            </h3>
            <span
              className="font-numeric text-[11px] uppercase tracking-[0.14em]"
              style={{ color: t.deep }}
            >
              {TYPE_LABEL[type]}
            </span>
          </div>
        </div>

        {/* meta line · subject · grade */}
        <div
          className="flex items-center gap-2 text-[13px] font-numeric tnum"
          style={{ color: 'var(--color-ink-3)' }}
        >
          <span>{subject}</span>
          <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>·</span>
          <span>{grade}</span>
        </div>

        {/* 副描述 · xuewen=人物简介 / debate=辩题 / discuss=主题。两行夹紧不让卡片高度漂。 */}
        {description && (
          <p
            className="text-[12.5px] leading-snug"
            style={{
              color: 'var(--color-ink-2)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.6em',
            }}
            title={description}
          >
            {description}
          </p>
        )}

        {/* 评价维度 chips · 辩论 / 讨论限定。前缀小标签写"评分"提示这是评估维度。 */}
        {showDims && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span
              className="font-numeric mr-0.5 text-[10px] uppercase tracking-[0.16em]"
              style={{ color: 'var(--color-ink-mute)' }}
              aria-hidden
            >
              评分
            </span>
            {dimsHead.map(d => (
              <span
                key={d}
                className="px-1.5 py-[2px] text-[11px]"
                style={{
                  background: t.bg,
                  color: t.deep,
                  borderRadius: 'var(--radius-xs)',
                  border: `1px solid ${t.bg}`,
                }}
              >
                {d}
              </span>
            ))}
            {dimsRest > 0 && (
              <span
                className="font-numeric tnum text-[11px]"
                style={{ color: 'var(--color-ink-mute)' }}
              >
                +{dimsRest}
              </span>
            )}
          </div>
        )}

        {!manageMode && (
          <span
            className="text-[12px] font-numeric tnum"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            上次 · {lastUsed}
          </span>
        )}
      </div>

      {/* 操作区 · 顶部 paper-rule 横线 + 文字按钮 */}
      {manageMode ? (
        <div
          className="grid grid-cols-2 border-t mt-1"
          style={{ borderTopColor: 'var(--color-paper-rule)' }}
        >
          <Link
            href={editHref}
            className="py-3 text-center text-[13px] font-medium transition-colors hover:bg-[var(--color-type-dialogue-bg)]"
            style={{ color: 'var(--color-type-dialogue-deep)' }}
          >
            编辑
          </Link>
          <button
            onClick={onDelete}
            className="border-l py-3 text-[13px] font-medium transition-colors hover:bg-[var(--color-type-debate-bg)]"
            style={{
              color: 'var(--color-type-debate-deep)',
              borderLeftColor: 'var(--color-paper-rule)',
            }}
          >
            删除
          </button>
        </div>
      ) : (
        <Link
          href={launchHref}
          className="mt-1 inline-flex items-center justify-center gap-2 border-t py-3.5 text-[15px] font-display font-medium transition-colors hover:bg-[var(--color-launch-bg)]"
          style={{
            color: 'var(--color-launch-deep)',
            borderTopColor: 'var(--color-paper-rule)',
          }}
        >
          <span aria-hidden style={{ fontFamily: 'var(--font-numeric)' }}>▶</span>
          <span>启动</span>
        </Link>
      )}
    </article>
  );
}
