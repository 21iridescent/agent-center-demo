'use client';

import { Field, INPUT_CX, TEXTAREA_CX, INPUT_STYLE, SUBJECTS, GRADES } from './Field';
import type { DiscussionAgentConfig } from '@/lib/agent-schemas';
import { COURSE_SEEDS } from '@/lib/courses';

interface Props {
  value: Partial<DiscussionAgentConfig>;
  onChange: (v: Partial<DiscussionAgentConfig>) => void;
}

const DURATION_MINUTES = [20, 30, 45, 60] as const;

const DEFAULT_SCAFFOLDS = [
  { label: '① 提出新观点', template: '我的观点是<空>，依据是<空>' },
  { label: '② 补充观点',   template: '我赞同<同学名>，并补充：<空>' },
  { label: '③ 反驳观点',   template: '我不同意<同学名>，因为：<空>' },
  { label: '④ 提问澄清',   template: '我想问<同学名>：<空>' },
  { label: '⑤ 总结归纳',   template: '目前我们达成的共识是：<空>；分歧是：<空>' },
  { label: '⑥ 联系实际',   template: '在我自己的生活中，<空>' },
];

export function DiscussionForm({ value, onChange }: Props) {
  function set<K extends keyof DiscussionAgentConfig>(k: K, v: DiscussionAgentConfig[K]) {
    onChange({ ...value, [k]: v });
  }

  const scaffolds = (value.scaffolds && value.scaffolds.length === 6
    ? value.scaffolds
    : DEFAULT_SCAFFOLDS);

  function setScaffold(i: number, patch: Partial<{ label: string; template: string }>) {
    const next = scaffolds.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    set('scaffolds', next as DiscussionAgentConfig['scaffolds']);
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="名称" required>
        <input
          className={INPUT_CX} style={INPUT_STYLE}
          value={value.name ?? ''}
          onChange={e => set('name', e.target.value)}
          placeholder="例：班级讨论助手"
        />
      </Field>

      <Field label="讨论主题" required>
        <input
          className={INPUT_CX} style={INPUT_STYLE}
          value={value.topic ?? ''}
          onChange={e => set('topic', e.target.value)}
          placeholder="例：班级是否应禁止带零食"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="学科" required>
          <select
            className={INPUT_CX} style={INPUT_STYLE}
            value={value.subject ?? ''}
            onChange={e => set('subject', e.target.value as DiscussionAgentConfig['subject'])}
          >
            <option value="" disabled>选择…</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="年级" required>
          <select
            className={INPUT_CX} style={INPUT_STYLE}
            value={value.grade ?? ''}
            onChange={e => set('grade', e.target.value as DiscussionAgentConfig['grade'])}
          >
            <option value="" disabled>选择…</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </div>

      <Field label="是否关联课程" hint="可选 · 选择后此智能体会出现在该门课程的工具中">
        <select
          className={INPUT_CX}
          style={INPUT_STYLE}
          value={value.linkedCourseId ?? ''}
          onChange={e => set('linkedCourseId', e.target.value || undefined)}
        >
          <option value="">不关联（默认）</option>
          {COURSE_SEEDS.map(c => (
            <option key={c.id} value={c.id}>
              {c.subject} · {c.grade} · {c.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="主持人名称" required>
        <input
          className={INPUT_CX} style={INPUT_STYLE}
          value={value.hostName ?? ''}
          onChange={e => set('hostName', e.target.value)}
          placeholder="例：科探助手"
        />
      </Field>

      <Field label="主持风格" required hint="如「鼓励发散；冷场时主动追问」">
        <textarea
          className={TEXTAREA_CX} style={INPUT_STYLE}
          value={value.hostStyle ?? ''}
          onChange={e => set('hostStyle', e.target.value)}
          rows={2}
        />
      </Field>

      <Field label="开场白" hint="主持人开场 · 抛主题 + 鼓励 + 提示用支架；AI 已按主题预填">
        <textarea
          className={TEXTAREA_CX} style={INPUT_STYLE}
          value={value.coldStart ?? ''}
          onChange={e => set('coldStart', e.target.value)}
          rows={3}
          placeholder="例：欢迎大家！今天我们聊聊『班级是否应禁带零食』，请用上方的观点支架，先听别人，再说自己。"
        />
      </Field>

      <Field label="讨论时长">
        <select
          className={INPUT_CX} style={INPUT_STYLE}
          value={String(value.durationMinutes ?? 30)}
          onChange={e => set('durationMinutes', Number(e.target.value) as DiscussionAgentConfig['durationMinutes'])}
        >
          {DURATION_MINUTES.map(m => <option key={m} value={m}>{m} 分钟</option>)}
        </select>
      </Field>

      <Field label="6 个观点支架" hint="标签 + 模板句（含 <空> 占位）">
        <div className="flex flex-col gap-2">
          {scaffolds.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${INPUT_CX} w-[140px] shrink-0`}
                style={INPUT_STYLE}
                value={s.label}
                onChange={e => setScaffold(i, { label: e.target.value })}
              />
              <input
                className={`${INPUT_CX} flex-1`}
                style={INPUT_STYLE}
                value={s.template}
                onChange={e => setScaffold(i, { template: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Field>
    </div>
  );
}
