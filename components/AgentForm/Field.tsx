import type { ReactNode } from 'react';

interface Props {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, required, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="text-[12px] font-medium" style={{ color: 'var(--color-text-3)' }}>
          {label}
        </label>
        {required && <span className="text-[11px]" style={{ color: 'var(--color-debate)' }}>*</span>}
        {hint && <span className="text-[11px]" style={{ color: 'var(--color-text-5)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export const INPUT_CX =
  'rounded-md border bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-bg-gray)]';

export const TEXTAREA_CX =
  'rounded-md border bg-white px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-[var(--color-primary)] resize-y min-h-[60px]';

export const INPUT_STYLE = { borderColor: 'var(--color-border-input)', color: 'var(--color-text)' } as const;

export const SUBJECTS = ['科学', '人工智能'] as const;
export const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'] as const;
