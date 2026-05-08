'use client';

interface Props {
  fields: { label: string; value: string }[];
  onEdit?: () => void;
}

/**
 * 备课工具页 · 上下文条
 * 显示当前课题/学段/参数。paper-card 浮纸 + smcp 标签 + display 值
 */
export function ContextStrip({ fields, onEdit }: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2 border px-5 py-3"
      style={{
        background: 'var(--color-paper-card)',
        borderColor: 'var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {fields.map((f, i) => (
        <span key={f.label} className="flex items-baseline gap-2.5">
          <span
            className="font-numeric text-[10px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            {f.label}
          </span>
          <span
            className="font-display text-[14px] font-medium"
            style={{ color: 'var(--color-ink-1)' }}
          >
            {f.value}
          </span>
          {i < fields.length - 1 && (
            <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>·</span>
          )}
        </span>
      ))}
      {onEdit && (
        <button
          onClick={onEdit}
          className="font-numeric ml-auto px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] transition-colors hover:[color:var(--color-ink-1)]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          改参数
        </button>
      )}
    </div>
  );
}
