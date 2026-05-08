'use client';

import { Field, INPUT_CX, TEXTAREA_CX, INPUT_STYLE, SUBJECTS, GRADES } from './Field';
import type { XuewenAgentConfig } from '@/lib/agent-schemas';

interface Props {
  value: Partial<XuewenAgentConfig>;
  onChange: (v: Partial<XuewenAgentConfig>) => void;
}

export function XuewenForm({ value, onChange }: Props) {
  function set<K extends keyof XuewenAgentConfig>(k: K, v: XuewenAgentConfig[K]) {
    onChange({ ...value, [k]: v });
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border bg-white p-5"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <Field label="名称" required hint="≤ 8 字，如「牛顿」">
        <input
          className={INPUT_CX}
          style={INPUT_STYLE}
          value={value.name ?? ''}
          onChange={e => set('name', e.target.value)}
          placeholder="例：牛顿"
        />
      </Field>

      <Field label="角色背景" required hint="80-200 字 · 性格 / 说话风格 / 知识范围">
        <textarea
          className={TEXTAREA_CX}
          style={INPUT_STYLE}
          value={value.background ?? ''}
          onChange={e => set('background', e.target.value)}
          placeholder="例：英国物理学家与数学家，发现万有引力。说话沉稳，善用比喻给小学生讲解力学..."
          rows={4}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="学科" required>
          <select
            className={INPUT_CX}
            style={INPUT_STYLE}
            value={value.subject ?? ''}
            onChange={e => set('subject', e.target.value as XuewenAgentConfig['subject'])}
          >
            <option value="" disabled>选择…</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="年级" required>
          <select
            className={INPUT_CX}
            style={INPUT_STYLE}
            value={value.grade ?? ''}
            onChange={e => set('grade', e.target.value as XuewenAgentConfig['grade'])}
          >
            <option value="" disabled>选择…</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </div>

      <Field label="音色" hint="可选 · 如「沉稳男声·适合历史人物」">
        <input
          className={INPUT_CX}
          style={INPUT_STYLE}
          value={value.voiceStyle ?? ''}
          onChange={e => set('voiceStyle', e.target.value)}
          placeholder="可选"
        />
      </Field>

      <Field label="关联知识库" hint="可选 · 用逗号分隔，如「教科版六年级科学, 我的电子书」">
        <input
          className={INPUT_CX}
          style={INPUT_STYLE}
          value={(value.knowledgeBases ?? []).join(', ')}
          onChange={e =>
            set(
              'knowledgeBases',
              e.target.value
                .split(/[,，]/)
                .map(s => s.trim())
                .filter(Boolean),
            )
          }
          placeholder="可选"
        />
      </Field>
    </div>
  );
}
