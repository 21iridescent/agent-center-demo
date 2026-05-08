'use client';

import { Field, INPUT_CX, TEXTAREA_CX, INPUT_STYLE, SUBJECTS, GRADES } from './Field';
import type { DebateAgentConfig } from '@/lib/agent-schemas';

interface Props {
  value: Partial<DebateAgentConfig>;
  onChange: (v: Partial<DebateAgentConfig>) => void;
}

const ROUND_DURATIONS = [60, 120, 180, 300] as const;
const TOTAL_ROUNDS = [2, 3, 4, 5] as const;
const JUDGE_TEMPLATES = [
  { value: 'default',     label: '默认' },
  { value: 'strict',      label: '严格' },
  { value: 'encouraging', label: '鼓励' },
  { value: 'neutral',     label: '中性' },
] as const;

export function DebateForm({ value, onChange }: Props) {
  function set<K extends keyof DebateAgentConfig>(k: K, v: DebateAgentConfig[K]) {
    onChange({ ...value, [k]: v });
  }
  function setSide(side: 'proSide' | 'conSide', patch: Partial<DebateAgentConfig['proSide']>) {
    onChange({
      ...value,
      [side]: { ...(value[side] ?? { type: 'ai', argument: '' }), ...patch },
    });
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border bg-white p-5"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <Field label="名称" required>
        <input
          className={INPUT_CX} style={INPUT_STYLE}
          value={value.name ?? ''}
          onChange={e => set('name', e.target.value)}
          placeholder="例：塑料禁令辩论"
        />
      </Field>

      <Field label="辩题" required>
        <input
          className={INPUT_CX} style={INPUT_STYLE}
          value={value.topic ?? ''}
          onChange={e => set('topic', e.target.value)}
          placeholder="例：一次性塑料袋是否应禁用"
        />
      </Field>

      <Field label="辩题背景" hint="2-4 句话 · 让 AI 评委判断时有依据">
        <textarea
          className={TEXTAREA_CX} style={INPUT_STYLE}
          value={value.background ?? ''}
          onChange={e => set('background', e.target.value)}
          rows={3}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="学科" required>
          <select
            className={INPUT_CX} style={INPUT_STYLE}
            value={value.subject ?? ''}
            onChange={e => set('subject', e.target.value as DebateAgentConfig['subject'])}
          >
            <option value="" disabled>选择…</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="年级" required>
          <select
            className={INPUT_CX} style={INPUT_STYLE}
            value={value.grade ?? ''}
            onChange={e => set('grade', e.target.value as DebateAgentConfig['grade'])}
          >
            <option value="" disabled>选择…</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </div>

      {/* 正方 */}
      <div
        className="flex flex-col gap-2.5 rounded-md border p-3"
        style={{ borderColor: 'var(--color-border-soft)', background: 'var(--color-bg-soft)' }}
      >
        <div className="text-[12px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
          正方
        </div>
        <Field label="参与者类型" required>
          <select
            className={INPUT_CX} style={INPUT_STYLE}
            value={value.proSide?.type ?? 'ai'}
            onChange={e => setSide('proSide', { type: e.target.value as 'ai' | 'human' })}
          >
            <option value="ai">AI（按论点自动发言）</option>
            <option value="human">真人 / 学生（手动输入）</option>
          </select>
        </Field>
        <Field label="正方论点" required>
          <textarea
            className={TEXTAREA_CX} style={INPUT_STYLE}
            value={value.proSide?.argument ?? ''}
            onChange={e => setSide('proSide', { argument: e.target.value })}
            rows={2}
            placeholder="一两句话写明立场和主要论据"
          />
        </Field>
      </div>

      {/* 反方 */}
      <div
        className="flex flex-col gap-2.5 rounded-md border p-3"
        style={{ borderColor: 'var(--color-border-soft)', background: 'var(--color-bg-soft)' }}
      >
        <div className="text-[12px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
          反方
        </div>
        <Field label="参与者类型" required>
          <select
            className={INPUT_CX} style={INPUT_STYLE}
            value={value.conSide?.type ?? 'human'}
            onChange={e => setSide('conSide', { type: e.target.value as 'ai' | 'human' })}
          >
            <option value="ai">AI（按论点自动发言）</option>
            <option value="human">真人 / 学生（手动输入）</option>
          </select>
        </Field>
        <Field label="反方论点" required>
          <textarea
            className={TEXTAREA_CX} style={INPUT_STYLE}
            value={value.conSide?.argument ?? ''}
            onChange={e => setSide('conSide', { argument: e.target.value })}
            rows={2}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="每轮倒计时">
          <select
            className={INPUT_CX} style={INPUT_STYLE}
            value={String(value.roundDurationSec ?? 120)}
            onChange={e => set('roundDurationSec', Number(e.target.value) as DebateAgentConfig['roundDurationSec'])}
          >
            {ROUND_DURATIONS.map(d => (
              <option key={d} value={d}>{d < 60 ? `${d}s` : `${d / 60} 分钟`}</option>
            ))}
          </select>
        </Field>
        <Field label="总轮数">
          <select
            className={INPUT_CX} style={INPUT_STYLE}
            value={String(value.totalRounds ?? 3)}
            onChange={e => set('totalRounds', Number(e.target.value) as DebateAgentConfig['totalRounds'])}
          >
            {TOTAL_ROUNDS.map(r => <option key={r} value={r}>{r} 轮</option>)}
          </select>
        </Field>
        <Field label="评委模板">
          <select
            className={INPUT_CX} style={INPUT_STYLE}
            value={value.judgeTemplate ?? 'default'}
            onChange={e => set('judgeTemplate', e.target.value as DebateAgentConfig['judgeTemplate'])}
          >
            {JUDGE_TEMPLATES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>
    </div>
  );
}
