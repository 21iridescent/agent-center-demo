'use client';

import { useState } from 'react';
import { useToast } from '../Toast';

interface PersonaCustom {
  avatarUrl: string;
  roleUrl: string;
  sourcePrompt?: string;
}

interface Props {
  /** 智能体名称（来自 form.value.name） */
  name: string;
  /** 形象描述（一般取 background 头一句或 sourcePrompt 片段） */
  traits?: string;
  /** 已生成的双图；undefined 时显示占位 */
  value?: PersonaCustom;
  /** 生成成功 / 清除 时回调；clear 时传 undefined */
  onChange: (v: PersonaCustom | undefined) => void;
}

/**
 * AI 人物形象生成 — 仅在 catalog 之外人物使用
 * 调 /api/generate-persona 拿双 data URL，回填到 personaCustom
 */
export function AiPersonaGen({ name, traits, value, onChange }: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function gen() {
    if (!name.trim()) {
      toast('请先填写名称');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/generate-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), traits: traits?.trim() }),
      });
      if (!res.ok) {
        const j: { error?: string } = await res.json().catch(() => ({}));
        toast(`生成失败：${j.error ?? res.statusText}`);
        return;
      }
      const json: { avatarDataUrl: string; roleDataUrl: string; sourcePrompt: string } =
        await res.json();
      onChange({
        avatarUrl: json.avatarDataUrl,
        roleUrl: json.roleDataUrl,
        sourcePrompt: json.sourcePrompt,
      });
      toast('已生成 AI 形象');
    } catch (e) {
      console.error(e);
      toast('生成失败：网络错误');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={gen}
        disabled={loading || !name.trim()}
        className="font-display text-[12px] font-medium leading-none px-3 py-2 border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          background: 'var(--color-paper-card)',
          borderColor: 'var(--color-paper-edge)',
          color: 'var(--color-ink-1)',
          borderRadius: 'var(--radius-xs)',
        }}
      >
        {loading ? '生成中…' : value ? '重新生成' : '✨ AI 生成形象'}
      </button>

      {value && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.avatarUrl}
            alt="AI 头像预览"
            className="object-cover"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '1px solid var(--color-paper-edge)',
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.roleUrl}
            alt="AI 全身像预览"
            className="object-cover object-top"
            style={{
              width: 36,
              height: 54,
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--color-paper-edge)',
            }}
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            disabled={loading}
            className="text-[11px] underline decoration-dotted underline-offset-[4px]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            清除
          </button>
        </div>
      )}
    </div>
  );
}
