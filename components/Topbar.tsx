import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  /** 显示在 brand 之后的面包屑名（如"课件大纲规划"），不传则只展示 brand */
  crumb?: string;
  /** 是否显示"我的记录"导航链接（默认显示） */
  showRecordsNav?: boolean;
  /** 顶栏右侧自定义槽位（保存按钮等）；不传则用默认用户 chip */
  right?: ReactNode;
}

export function Topbar({ crumb, showRecordsNav = true, right }: Props) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-7 border-b px-12"
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--color-paper-card)',
        borderColor: 'var(--color-paper-rule)',
      }}
    >
      {/* Brand · 章式印 + display 字 */}
      <Link href="/" className="flex items-center gap-4 group">
        <span
          className="stamp h-12 w-12 text-[18px]"
          style={{ borderRadius: 'var(--radius-sm)' }}
          aria-hidden
        >
          AC
        </span>
        <span
          className="font-display text-[28px] font-medium tracking-[0.3px] leading-none"
          style={{ color: 'var(--color-ink-1)' }}
        >
          智能体中心
        </span>
      </Link>

      {crumb ? (
        <>
          <span
            className="font-numeric text-[22px]"
            style={{ color: 'var(--color-ink-faint)' }}
            aria-hidden
          >
            /
          </span>
          <span
            className="font-display text-[22px] font-medium leading-none"
            style={{ color: 'var(--color-ink-2)' }}
          >
            {crumb}
          </span>
        </>
      ) : (
        showRecordsNav && (
          <nav className="ml-4 flex items-center gap-6">
            {/* 我的产出 = prep 一类（教案/大纲/习题/活动/PBL）通过 ?filter=prep 落到记录页 */}
            <Link
              href="/records?filter=prep"
              className="text-[17px] transition-colors hover:underline underline-offset-[8px] decoration-1"
              style={{ color: 'var(--color-ink-3)' }}
            >
              我的产出
            </Link>
            <Link
              href="/records"
              className="text-[17px] transition-colors hover:underline underline-offset-[8px] decoration-1"
              style={{ color: 'var(--color-ink-3)' }}
            >
              我的记录
            </Link>
          </nav>
        )
      )}

      {right ? (
        <div className="ml-auto flex items-center gap-3">{right}</div>
      ) : (
        <div
          className="ml-auto flex items-center gap-3 text-[15px]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          <span
            className="font-numeric flex h-11 w-11 items-center justify-center text-[16px] font-semibold"
            style={{
              background: 'var(--color-paper-soft)',
              color: 'var(--color-ink-2)',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-hidden
          >
            李
          </span>
          <span>李老师</span>
        </div>
      )}
    </header>
  );
}
