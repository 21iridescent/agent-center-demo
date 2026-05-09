import type { ReactNode } from 'react';

interface Props {
  /**
   * 章节号——保留 ①②③ 入参以兼容现有 page.tsx
   * 内部映射到阿拉伯数字 stamp（"01"/"02"/"03"），符合 editorial 章式约定
   */
  num: '①' | '②' | '③' | '④';
  title: string;
  sub: string;
  /** 右侧统计文案，如"共 4 个" */
  meta?: ReactNode;
  /** 右侧按钮区 */
  actions?: ReactNode;
  children: ReactNode;
}

const NUM_MAP: Record<Props['num'], string> = {
  '①': '01',
  '②': '02',
  '③': '03',
  '④': '04',
};

export function HomePhase({ num, title, sub, meta, actions, children }: Props) {
  return (
    <section className="mb-[var(--space-4xl)]">
      {/* 章节版口 · 上 rule line + stamp + display 主标题 */}
      <header
        className="mb-[var(--space-2xl)] flex items-end gap-5 border-t pt-5"
        style={{ borderColor: 'var(--color-paper-rule)' }}
      >
        <span
          className="stamp h-10 w-10 shrink-0 text-[15px]"
          style={{ borderRadius: 'var(--radius-xs)' }}
          aria-hidden
        >
          {NUM_MAP[num]}
        </span>

        <div className="flex flex-1 items-baseline gap-4 min-w-0">
          <h2
            className="font-display text-[28px] font-medium leading-none tracking-[0.5px]"
            style={{ color: 'var(--color-ink-1)' }}
          >
            {title}
          </h2>
          <p
            className="text-[14px] leading-snug truncate"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {sub}
          </p>
        </div>

        {meta && (
          <span
            className="font-numeric tnum text-[12px] shrink-0"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            {meta}
          </span>
        )}
        {actions && (
          <div className="flex items-center gap-3 shrink-0">{actions}</div>
        )}
      </header>

      {children}
    </section>
  );
}
