import type { ReactNode } from 'react';

interface Props {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * 表单字段 · editorial label
 * label 用 numeric smcp（小型大写）+ ink-2，配 type-debate 必填星 + ink-mute 提示
 */
export function Field({ label, hint, required, children }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <label
          className="font-display text-[13px] font-medium leading-none"
          style={{ color: 'var(--color-ink-2)' }}
        >
          {label}
        </label>
        {required && (
          <span
            className="text-[11px] leading-none"
            style={{ color: 'var(--color-type-debate)' }}
            aria-hidden
          >
            ✱
          </span>
        )}
        {hint && (
          <span
            className="text-[11px] leading-snug"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * 输入控件统一样式 · paper-card 底 + paper-edge 框 + paper-stamp focus
 */
export const INPUT_CX =
  'border bg-[var(--color-paper-card)] px-3 py-2 text-[14px] outline-none transition-colors focus:border-[var(--color-paper-stamp)] disabled:bg-[var(--color-paper-soft)]';

export const TEXTAREA_CX =
  'border bg-[var(--color-paper-card)] px-3 py-2 text-[14px] leading-relaxed outline-none transition-colors focus:border-[var(--color-paper-stamp)] resize-y min-h-[64px]';

export const INPUT_STYLE = {
  borderColor: 'var(--color-paper-edge)',
  color: 'var(--color-ink-1)',
  borderRadius: 'var(--radius-sm)',
} as const;

export const SUBJECTS = ['科学', '人工智能'] as const;
export const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'] as const;
