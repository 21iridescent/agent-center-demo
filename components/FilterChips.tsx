'use client';

import type { RecordType } from '@/lib/types';

export type FilterValue = 'all' | RecordType;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all',        label: '全部' },
  { value: 'dialogue',   label: 'AI 学问' },
  { value: 'debate',     label: 'AI 辩论' },
  { value: 'discussion', label: 'AI 讨论' },
  { value: 'prep',       label: '产出' },
];

interface Props {
  current: FilterValue;
  onChange: (v: FilterValue) => void;
  resultHint?: string;
}

export function FilterChips({ current, onChange, resultHint }: Props) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-3"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <span className="mr-2 text-[13px]" style={{ color: 'var(--color-text-4)' }}>
        类型
      </span>
      {FILTERS.map(f => {
        const active = f.value === current;
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className="rounded-full border px-3.5 py-1 text-[12px] transition-colors"
            style={
              active
                ? {
                    background: 'var(--color-primary)',
                    color: '#fff',
                    borderColor: 'var(--color-primary)',
                  }
                : {
                    background: 'white',
                    color: 'var(--color-text-3)',
                    borderColor: 'var(--color-border)',
                  }
            }
          >
            {f.label}
          </button>
        );
      })}
      {resultHint && (
        <span className="ml-auto text-[12px]" style={{ color: 'var(--color-text-4)' }}>
          {resultHint}
        </span>
      )}
    </div>
  );
}
