'use client';

import { useMemo } from 'react';
import { INPUT_CX, INPUT_STYLE } from './Field';
import {
  COURSE_UNITS,
  getCourseById,
  type Grade,
} from '@/lib/courses';

interface Props {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}

/**
 * 表单内的课程关联三级级联选择器：年级 → 单元 → 课程
 *
 * - 已选 linkedCourseId 时反向解析三级回填
 * - 三级都选完才回写 linkedCourseId；前两级只是临时筛选
 * - 「不关联」按钮：清空 → undefined
 *
 * 顶栏归档用的是另一个 paper-card 风格的 `CoursePicker`，不复用。
 */
export function CourseFormPicker({ value, onChange }: Props) {
  const selected = getCourseById(value);

  const grades = useMemo<Grade[]>(() => {
    const set = new Set<Grade>();
    COURSE_UNITS.forEach(u => set.add(u.grade));
    return [...set];
  }, []);

  const grade = selected?.grade;
  const unitId = selected?.unitId;

  const units = useMemo(
    () => COURSE_UNITS.filter(u => !grade || u.grade === grade),
    [grade],
  );

  const lessons = useMemo(() => {
    const u = COURSE_UNITS.find(x => x.id === unitId);
    return u?.courses ?? [];
  }, [unitId]);

  function pickGrade(g: string) {
    if (!g) return onChange(undefined);
    const firstUnit = COURSE_UNITS.find(u => u.grade === g);
    const firstLesson = firstUnit?.courses[0];
    onChange(firstLesson?.id);
  }

  function pickUnit(uid: string) {
    if (!uid) return onChange(undefined);
    const u = COURSE_UNITS.find(x => x.id === uid);
    onChange(u?.courses[0]?.id);
  }

  function pickLesson(lid: string) {
    onChange(lid || undefined);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <select
          className={INPUT_CX}
          style={INPUT_STYLE}
          value={grade ?? ''}
          onChange={e => pickGrade(e.target.value)}
        >
          <option value="">年级…</option>
          {grades.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          className={INPUT_CX}
          style={INPUT_STYLE}
          value={unitId ?? ''}
          disabled={!grade}
          onChange={e => pickUnit(e.target.value)}
        >
          <option value="">单元…</option>
          {units.map(u => (
            <option key={u.id} value={u.id}>
              {u.title}
            </option>
          ))}
        </select>

        <select
          className={INPUT_CX}
          style={INPUT_STYLE}
          value={value ?? ''}
          disabled={!unitId}
          onChange={e => pickLesson(e.target.value)}
        >
          <option value="">课程…</option>
          {lessons.map(l => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between text-[12px]">
        {selected ? (
          <span style={{ color: 'var(--color-ink-2)' }}>
            已选：{selected.grade} · {selected.unit} · {selected.title}
          </span>
        ) : (
          <span style={{ color: 'var(--color-ink-mute)' }}>未关联课程</span>
        )}
        {selected && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="font-numeric text-[11px] uppercase tracking-[0.12em] underline-offset-2 hover:underline"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            清除
          </button>
        )}
      </div>
    </div>
  );
}
