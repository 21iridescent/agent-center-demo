'use client';

import { TOPIC_THUMBS } from '@/lib/asset-catalog';

interface Props {
  value?: string;
  onChange: (id: string | undefined) => void;
}

/**
 * 辩论 · 话题封面 picker（可选）
 * - 横向滚动 + 第一格"无封面"
 * - 10 个候选缩略图，比例 16:9
 */
export function TopicThumbPicker({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1.5">
      {/* 无封面 */}
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className="flex shrink-0 flex-col items-center justify-center rounded-md border border-dashed bg-white text-[11px]"
        style={{
          borderColor: !value ? 'var(--color-debate)' : 'var(--color-border)',
          color: !value ? 'var(--color-debate)' : 'var(--color-text-5)',
          width: 80,
          height: 60,
        }}
      >
        无封面
      </button>

      {TOPIC_THUMBS.map(t => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="group relative flex shrink-0 flex-col gap-0.5 overflow-hidden rounded-md border bg-white p-1 text-left transition-all"
            style={{
              borderColor: selected ? 'var(--color-debate)' : 'var(--color-border)',
              boxShadow: selected ? '0 0 0 2px var(--color-debate-bg)' : 'none',
              width: 110,
            }}
          >
            <div
              className="relative w-full overflow-hidden rounded-sm"
              style={{ aspectRatio: '16 / 9', background: 'var(--color-bg-gray)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.src}
                alt={t.label}
                loading="lazy"
                width={640}
                height={360}
                className="h-full w-full object-cover"
              />
            </div>
            <span
              className="px-0.5 text-[10.5px] leading-tight truncate"
              style={{ color: selected ? 'var(--color-debate)' : 'var(--color-text-2)' }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
