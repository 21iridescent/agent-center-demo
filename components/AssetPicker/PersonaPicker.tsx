'use client';

import { PERSONAS } from '@/lib/asset-catalog';

interface CustomPreview {
  avatarUrl: string;
  label?: string;
}

interface Props {
  value?: string;
  onChange: (id: string) => void;
  /** 第 7 个 tile：AI 生成预览（已生成时显示头像；未生成显示 ✨）*/
  customPreview?: CustomPreview;
  /** 第 7 个 tile 选中态（与 value 互斥；当 personaId 为空且 personaCustom 存在时为 true）*/
  customSelected?: boolean;
  /** 点击第 7 个 tile：仅 onSelect；生成动作由外部 AiPersonaGen 控制 */
  onPickCustom?: () => void;
}

/**
 * 学问 · 6 个虚拟人物 picker（+ 第 7 格 AI 生成）
 * 卡片网格 3 列；圆形头像 + 名 + 一句简介；单选；选中加蓝边 + 浅蓝底
 */
export function PersonaPicker({
  value,
  onChange,
  customPreview,
  customSelected,
  onPickCustom,
}: Props) {
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {PERSONAS.xuewen.map(p => {
        const selected = p.id === value && !customSelected;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className="flex flex-col items-center gap-1.5 rounded-md border bg-white p-2.5 text-center transition-all"
            style={{
              borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
              background: selected ? 'var(--color-primary-bg)' : '#fff',
              boxShadow: selected ? '0 0 0 2px var(--color-primary-bg)' : 'none',
            }}
          >
            <div
              className="overflow-hidden rounded-full"
              style={{
                width: 56,
                height: 56,
                border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border-soft)'}`,
                background: 'var(--color-bg-gray)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.avatar}
                alt={p.label}
                loading="lazy"
                width={512}
                height={512}
                className="h-full w-full object-cover"
              />
            </div>
            <span
              className="text-[13px] font-semibold leading-tight"
              style={{ color: selected ? 'var(--color-primary)' : 'var(--color-text)' }}
            >
              {p.label}
            </span>
            <span
              className="text-[10.5px] leading-tight"
              style={{ color: 'var(--color-text-4)' }}
            >
              {p.blurb}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onPickCustom?.()}
        className="flex flex-col items-center gap-1.5 rounded-md border bg-white p-2.5 text-center transition-all"
        style={{
          borderColor: customSelected ? 'var(--color-primary)' : 'var(--color-border)',
          background: customSelected ? 'var(--color-primary-bg)' : '#fff',
          boxShadow: customSelected ? '0 0 0 2px var(--color-primary-bg)' : 'none',
          borderStyle: customPreview ? 'solid' : 'dashed',
        }}
      >
        <div
          className="flex items-center justify-center overflow-hidden rounded-full"
          style={{
            width: 56,
            height: 56,
            border: `2px solid ${customSelected ? 'var(--color-primary)' : 'var(--color-border-soft)'}`,
            background: 'var(--color-bg-gray)',
          }}
        >
          {customPreview?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customPreview.avatarUrl}
              alt={customPreview.label ?? 'AI 生成形象'}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-[20px]" aria-hidden>
              ✨
            </span>
          )}
        </div>
        <span
          className="text-[13px] font-semibold leading-tight"
          style={{ color: customSelected ? 'var(--color-primary)' : 'var(--color-text)' }}
        >
          {customPreview ? customPreview.label ?? 'AI 形象' : 'AI 生成'}
        </span>
        <span
          className="text-[10.5px] leading-tight"
          style={{ color: 'var(--color-text-4)' }}
        >
          {customPreview ? '已生成 · 可重新画' : '不在 6 人之内时'}
        </span>
      </button>
    </div>
  );
}
