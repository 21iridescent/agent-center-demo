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
  name: string;
  subject: string;
  grade: string;
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
  name,
  subject,
  grade,
  lastUsed,
  launchHref,
  editHref,
  manageMode,
  onDelete,
}: Props) {
  const t = TYPE_TOKENS[type];

  return (
    <article
      className="group relative flex flex-col overflow-hidden border transition-all duration-200 hover:[box-shadow:var(--shadow-pop)]"
      style={{
        borderColor: 'var(--color-paper-edge)',
        background: 'var(--color-paper-card)',
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

      <div className="flex flex-col gap-3 px-5 pt-4 pb-3">
        {/* 头部 · 方形头像章 + 标题 + smcp type label */}
        <div className="flex items-start gap-3">
          <span
            className="font-numeric flex h-11 w-11 shrink-0 items-center justify-center text-[16px] font-bold"
            style={{
              background: t.bg,
              color: t.deep,
              borderRadius: 'var(--radius-xs)',
            }}
            aria-hidden
          >
            {avatar}
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
