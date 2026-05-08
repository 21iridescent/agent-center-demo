'use client';

interface Props {
  fields: { label: string; value: string }[];
  onEdit?: () => void;
}

export function ContextStrip({ fields, onEdit }: Props) {
  return (
    <div
      className="flex items-center gap-4 rounded-md border bg-white px-4 py-3 text-[13px]"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {fields.map((f, i) => (
        <span key={f.label} className="flex items-center gap-2">
          <span style={{ color: 'var(--color-text-5)' }}>{f.label}</span>
          <span className="font-medium" style={{ color: 'var(--color-text)' }}>
            {f.value}
          </span>
          {i < fields.length - 1 && (
            <span style={{ color: 'var(--color-text-7)' }}>·</span>
          )}
        </span>
      ))}
      {onEdit && (
        <button
          onClick={onEdit}
          className="ml-auto rounded-md px-2.5 py-1 text-[12px] transition-colors hover:bg-[var(--color-primary-bg)]"
          style={{ color: 'var(--color-text-3)' }}
        >
          改参数
        </button>
      )}
    </div>
  );
}
