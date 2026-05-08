import Link from 'next/link';

interface Props {
  href: string;
  icon: string; // emoji or single character
  name: string;
  desc: string;
  tags: string[];
}

/**
 * 备课工具卡 · library catalog card
 * - 1px paper-edge 框 + paper-card 浮纸底 + 极轻 shadow-sm
 * - 顶部 paper-stamp 章式横条（neutral, 备课不是 type-bound）
 * - hover 时 shadow-pop, 行动文案位移
 */
export function ToolCard({ href, icon, name, desc, tags }: Props) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden border transition-all duration-200 hover:[box-shadow:var(--shadow-pop)]"
      style={{
        borderColor: 'var(--color-paper-edge)',
        background: 'var(--color-paper-card)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* 顶部章式横条 — neutral 4px paper-stamp */}
      <span
        aria-hidden
        className="block h-[4px] w-full"
        style={{ background: 'var(--color-paper-stamp)' }}
      />

      <div className="flex flex-1 flex-col gap-3 px-5 pt-4 pb-4">
        <div
          className="text-[24px] leading-none"
          style={{ color: 'var(--color-ink-1)' }}
          aria-hidden
        >
          {icon}
        </div>

        <h3
          className="font-display text-[18px] font-medium leading-tight"
          style={{ color: 'var(--color-ink-1)' }}
        >
          {name}
        </h3>

        <p
          className="flex-1 text-[13px] leading-[1.6]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {desc}
        </p>

        <div
          className="flex flex-wrap gap-x-2 text-[11px] font-numeric tnum"
          style={{ color: 'var(--color-ink-mute)' }}
        >
          {tags.map((t, i) => (
            <span key={t} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>
                  ·
                </span>
              )}
              <span>{t}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 行动栏 · 顶部 paper-rule + hover bg paper-soft */}
      <span
        className="inline-flex items-center justify-between gap-1.5 border-t px-5 py-3 text-[14px] font-medium font-display transition-colors group-hover:bg-[var(--color-paper-soft)]"
        style={{
          color: 'var(--color-type-dialogue-deep)',
          borderTopColor: 'var(--color-paper-rule)',
        }}
      >
        <span>进入</span>
        <span
          aria-hidden
          className="transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </span>
    </Link>
  );
}
