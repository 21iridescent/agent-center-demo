'use client';

import Link from 'next/link';

const TYPE_LABEL = {
  dialogue: 'AI 学问',
  debate: 'AI 辩论',
  discuss: 'AI 讨论',
} as const;

const TYPE_COLORS = {
  dialogue: { bg: 'var(--color-primary-bg)',    fg: 'var(--color-primary)' },
  debate:   { bg: 'var(--color-debate-bg)',     fg: 'var(--color-debate)' },
  discuss:  { bg: 'var(--color-discussion-bg)', fg: 'var(--color-discussion)' },
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
  const colors = TYPE_COLORS[type];
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border bg-white p-[18px] transition-shadow hover:[box-shadow:var(--shadow-md)]"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
          style={{ background: colors.bg, color: colors.fg }}
        >
          {avatar}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className="truncate text-[14px] font-semibold leading-tight"
            style={{ color: 'var(--color-text)' }}
          >
            {name}
          </span>
          <span className="text-[11px] font-medium leading-tight" style={{ color: colors.fg }}>
            {TYPE_LABEL[type]}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 text-[12px] leading-snug"
        style={{ color: 'var(--color-text-4)' }}
      >
        <span>{subject}</span>
        <span style={{ color: 'var(--color-text-7)' }}>·</span>
        <span>{grade}</span>
      </div>

      {!manageMode && (
        <span className="mt-auto text-[11px]" style={{ color: 'var(--color-text-5)' }}>
          上次 {lastUsed}
        </span>
      )}

      {manageMode ? (
        <div className="mt-auto flex gap-2">
          <Link
            href={editHref}
            className="flex-1 rounded-md border bg-white py-1.5 text-center text-[12px] transition-colors hover:bg-[var(--color-primary-bg)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
          >
            编辑
          </Link>
          <button
            onClick={onDelete}
            className="flex-1 rounded-md border bg-white py-1.5 text-[12px] transition-colors hover:bg-[var(--color-debate-bg)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-debate)' }}
          >
            删除
          </button>
        </div>
      ) : (
        <Link
          href={launchHref}
          className="rounded-md py-2 text-center text-[13px] font-semibold text-white transition-colors"
          style={{ background: 'var(--color-success)' }}
        >
          ▶ 启动
        </Link>
      )}
    </div>
  );
}
