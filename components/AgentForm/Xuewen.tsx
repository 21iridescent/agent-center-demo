'use client';

import { Field, INPUT_CX, TEXTAREA_CX, INPUT_STYLE, SUBJECTS, GRADES } from './Field';
import { BackgroundPicker, PersonaPicker } from '../AssetPicker';
import { AiPersonaGen } from './AiPersonaGen';
import type { XuewenAgentConfig } from '@/lib/agent-schemas';

interface Props {
  value: Partial<XuewenAgentConfig>;
  onChange: (v: Partial<XuewenAgentConfig>) => void;
}

export function XuewenForm({ value, onChange }: Props) {
  function set<K extends keyof XuewenAgentConfig>(k: K, v: XuewenAgentConfig[K]) {
    onChange({ ...value, [k]: v });
  }

  const customSelected = !value.personaId && !!value.personaCustom;

  return (
    <div className="flex flex-col gap-5">
      <Field label="人物形象" hint="6 个候选；不在的话按 [✨ AI 生成]">
        <div className="flex flex-col gap-2.5">
          <PersonaPicker
            value={value.personaId}
            onChange={v => {
              onChange({
                ...value,
                personaId: v as XuewenAgentConfig['personaId'],
                personaCustom: undefined,
              });
            }}
            customPreview={
              value.personaCustom
                ? { avatarUrl: value.personaCustom.avatarUrl, label: value.name }
                : undefined
            }
            customSelected={customSelected}
            onPickCustom={() => {
              if (value.personaCustom) {
                onChange({ ...value, personaId: undefined });
              }
            }}
          />
          <AiPersonaGen
            name={value.name ?? ''}
            traits={(value.background ?? '').slice(0, 100)}
            value={value.personaCustom}
            onChange={pc => {
              onChange({
                ...value,
                personaCustom: pc,
                personaId: pc ? undefined : value.personaId,
              });
            }}
          />
        </div>
      </Field>

      <Field label="背景场景" hint="3 个候选 · 决定使用页画布感觉">
        <BackgroundPicker
          kind="xuewen"
          value={value.bgAsset}
          onChange={v => set('bgAsset', v as XuewenAgentConfig['bgAsset'])}
        />
      </Field>

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

      <Field label="开场白" hint="使用页第一句 · AI 已按角色风格预填，可改">
        <textarea
          className={TEXTAREA_CX}
          style={INPUT_STYLE}
          value={value.coldStart ?? ''}
          onChange={e => set('coldStart', e.target.value)}
          placeholder="例：你好同学们！我是牛顿，三百年前在英国研究力学。今天想和你们聊聊苹果落地背后的小秘密——准备好了吗？"
          rows={3}
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
