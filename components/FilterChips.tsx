'use client';

import type { RecordType } from '@/lib/types';

export type FilterValue = 'all' | RecordType;

const FILTERS: { value: FilterValue; label: string; tone?: string }[] = [
  { value: 'all',        label: '全部' },
  { value: 'dialogue',   label: 'AI 学问',   tone: 'var(--color-type-dialogue-deep)' },
  { value: 'debate',     label: 'AI 辩论',   tone: 'var(--color-type-debate-deep)' },
  { value: 'discussion', label: 'AI 讨论',   tone: 'var(--color-type-discussion-deep)' },
  { value: 'prep',       label: '产出',      tone: 'var(--color-prep)' },
];

interface Props {
  current: FilterValue;
  onChange: (v: FilterValue) => void;
  resultHint?: string;
}

/**
 * 类型筛选条 · paper-card 浮纸 + 章式 stamp 选中态
 */
export function FilterChips({ current, onChange, resultHint }: Props) {
  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-2 border px-5 py-3"
      style={{
        background: 'var(--color-paper-card)',
        borderColor: 'var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <span
        className="font-numeric mr-3 text-[11px] uppercase tracking-[0.14em]"
        style={{ color: 'var(--color-ink-mute)' }}
      >
        类型
      </span>
      {FILTERS.map(f => {
        const active = f.value === current;
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className="px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            style={
              active
                ? {
                    background: 'var(--color-paper-stamp)',
                    color: 'var(--color-paper-base)',
                    borderRadius: 'var(--radius-xs)',
                    letterSpacing: '0.2px',
                  }
                : {
                    background: 'transparent',
                    color: f.tone ?? 'var(--color-ink-2)',
                    border: '1px solid var(--color-paper-edge)',
                    borderRadius: 'var(--radius-xs)',
                  }
            }
          >
            {f.label}
          </button>
        );
      })}
      {resultHint && (
        <span
          className="font-numeric tnum ml-auto text-[12px]"
          style={{ color: 'var(--color-ink-mute)' }}
        >
          {resultHint}
        </span>
      )}
    </div>
  );
}
