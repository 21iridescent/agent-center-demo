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
      className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-8"
      style={{
        height: 'var(--topbar-height)',
        borderColor: 'var(--color-border)',
      }}
    >
      {crumb ? (
        <>
          <Link
            href="/"
            className="rounded-md px-2.5 py-1 text-[14px] transition-colors hover:bg-[var(--color-primary-bg)] hover:text-[var(--color-primary)]"
            style={{ color: 'var(--color-primary)' }}
          >
            ← 智能体中心
          </Link>
          <span className="text-[12px]" style={{ color: 'var(--color-text-7)' }}>/</span>
          <span className="text-[16px] font-semibold" style={{ color: 'var(--color-text)' }}>
            {crumb}
          </span>
        </>
      ) : (
        <>
          <span className="text-[17px] font-semibold" style={{ color: 'var(--color-primary)' }}>
            智能体中心
          </span>
          {showRecordsNav && (
            <Link
              href="/records"
              className="ml-2 rounded-md px-3 py-1.5 text-[13px] transition-colors hover:bg-[var(--color-primary-bg)] hover:text-[var(--color-primary)]"
              style={{ color: 'var(--color-text-3)' }}
            >
              我的记录
            </Link>
          )}
        </>
      )}

      {right ? (
        <div className="ml-auto flex items-center gap-3">{right}</div>
      ) : (
        <div className="ml-auto flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-text-3)' }}>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold"
            style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}
          >
            李
          </span>
          <span>李老师</span>
        </div>
      )}
    </header>
  );
}
