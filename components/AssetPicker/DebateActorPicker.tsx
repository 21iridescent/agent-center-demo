'use client';

import { DEBATE_ACTORS } from '@/lib/asset-catalog';

interface Props {
  side: 'pro' | 'con';
  value?: string;
  onChange: (id: string) => void;
  /** type=ai 时把 *-ai 排前面，type=human 时把 *-student 排前面 */
  preferKind?: 'ai' | 'human';
}

/**
 * 辩论 · 单方辩手全身像 picker
 * - 同一方 (side) 有 2 个候选：*-ai 和 *-student
 * - preferKind 决定排序，但用户仍可任意切
 */
export function DebateActorPicker({ side, value, onChange, preferKind = 'ai' }: Props) {
  const colorVar = side === 'pro' ? 'var(--color-primary)' : 'var(--color-debate)';
  const colorBgVar = side === 'pro' ? 'var(--color-primary-bg)' : 'var(--color-debate-bg)';

  // 同一 side 的 actor，按 preferKind 排序
  const candidates = DEBATE_ACTORS
    .filter(a => a.side === side)
    .sort((a, b) => (a.kind === preferKind ? -1 : b.kind === preferKind ? 1 : 0));

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {candidates.map(actor => {
        const selected = actor.id === value;
        return (
          <button
            key={actor.id}
            type="button"
            onClick={() => onChange(actor.id)}
            className="flex flex-col items-center gap-1.5 rounded-md border bg-white p-2 text-center transition-all"
            style={{
              borderColor: selected ? colorVar : 'var(--color-border)',
              background: selected ? colorBgVar : '#fff',
              boxShadow: selected ? `0 0 0 2px ${colorBgVar}` : 'none',
            }}
          >
            <div
              className="w-full overflow-hidden rounded-sm"
              style={{
                aspectRatio: '2 / 3',
                maxHeight: 130,
                background: 'var(--color-bg-gray)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={actor.role}
                alt={actor.label}
                loading="lazy"
                width={1024}
                height={1536}
                className="h-full w-full object-cover object-top"
              />
            </div>
            <span
              className="text-[12px] font-medium leading-tight"
              style={{ color: selected ? colorVar : 'var(--color-text)' }}
            >
              {actor.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
