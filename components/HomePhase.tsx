import type { ReactNode } from 'react';

interface Props {
  num: '①' | '②' | '③';
  title: string;
  sub: string;
  meta?: ReactNode;   // 右侧统计文案，如"共 4 个"
  actions?: ReactNode; // 右侧按钮区
  children: ReactNode;
}

export function HomePhase({ num, title, sub, meta, actions, children }: Props) {
  return (
    <section className="mb-16">
      <div
        className="mb-6 flex items-baseline gap-3 border-b pb-4"
        style={{ borderColor: 'var(--color-border-soft)' }}
      >
        <span
          className="shrink-0 text-[18px] font-semibold leading-none"
          style={{ color: 'var(--color-text-5)' }}
        >
          {num}
        </span>
        <span
          className="text-[18px] font-semibold leading-none tracking-[0.2px]"
          style={{ color: 'var(--color-text)' }}
        >
          {title}
        </span>
        <span
          className="ml-1 flex-1 text-[13px] leading-snug"
          style={{ color: 'var(--color-text-4)' }}
        >
          {sub}
        </span>
        {meta && <span className="text-[12px] tnum" style={{ color: 'var(--color-text-5)' }}>{meta}</span>}
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
