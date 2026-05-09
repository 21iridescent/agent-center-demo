'use client';

import { COURSE_UNITS } from '@/lib/courses';

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
}

/**
 * 课程归档选择器 · 顶栏右侧
 * - 直接 import COURSE_UNITS（demo 阶段静态种子，无需 fetch）；用 optgroup 把课程按「年级·学科·单元」分组
 * - paper-card 底 + paper-rule 边线，与 SaveButton 共栖
 * - 默认 '不关联课程'，选中后小圆点上学问蓝（与 records:byCourse:* 反向索引一一对应）
 */
export function CoursePicker({ value, onChange }: Props) {
  return (
    <label
      className="flex h-10 items-center gap-2 px-3 text-[13px]"
      style={{
        background: 'var(--color-paper-card)',
        border: '1px solid var(--color-paper-rule)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--color-ink-1)',
      }}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: value ? 'var(--color-type-dialogue)' : 'var(--color-paper-rule)',
        }}
      />
      <span
        className="font-numeric text-[10px] uppercase tracking-[0.14em]"
        style={{ color: 'var(--color-ink-mute)' }}
      >
        归档至
      </span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="font-display cursor-pointer bg-transparent outline-none"
        style={{ color: 'var(--color-ink-1)' }}
      >
        <option value="">不关联课程</option>
        {COURSE_UNITS.map(u => (
          <optgroup
            key={u.id}
            label={`${u.grade} · ${u.subject} · ${u.title}`}
          >
            {u.courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
