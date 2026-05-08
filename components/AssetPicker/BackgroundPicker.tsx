'use client';

import { BACKGROUNDS } from '@/lib/asset-catalog';

interface Props {
  kind: keyof typeof BACKGROUNDS;
  value?: string;
  onChange: (id: string) => void;
}

/**
 * 横向背景缩略图 picker
 * - 单选；点击切换
 * - 缩略图比例保持 16:9
 * - kind=xuewen 有 3 张；debate/discussion 各 1 张
 */
export function BackgroundPicker({ kind, value, onChange }: Props) {
  const options = BACKGROUNDS[kind];

  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map(bg => {
        const selected = bg.id === value;
        return (
          <button
            key={bg.id}
            type="button"
            onClick={() => onChange(bg.id)}
            className="group relative flex flex-col gap-1.5 overflow-hidden rounded-md border bg-white p-1.5 text-left transition-all"
            style={{
              borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
              boxShadow: selected ? '0 0 0 2px var(--color-primary-bg)' : 'none',
              width: 160,
            }}
          >
            <div
              className="relative w-full overflow-hidden rounded-sm"
              style={{ aspectRatio: '16 / 9', background: 'var(--color-bg-gray)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bg.src}
                alt={bg.label}
                loading="lazy"
                width={1600}
                height={900}
                className="h-full w-full object-cover"
              />
              {selected && (
                <div
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: 'var(--color-primary)' }}
                >
                  ✓
                </div>
              )}
            </div>
            <div className="flex flex-col gap-0.5 px-0.5">
              <span
                className="text-[12px] font-medium leading-tight"
                style={{ color: selected ? 'var(--color-primary)' : 'var(--color-text)' }}
              >
                {bg.label}
              </span>
              {'hint' in bg && bg.hint && (
                <span className="text-[10.5px] leading-tight" style={{ color: 'var(--color-text-5)' }}>
                  {bg.hint}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
