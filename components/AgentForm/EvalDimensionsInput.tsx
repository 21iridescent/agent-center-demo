'use client';

import { useState } from 'react';
import { INPUT_CX, INPUT_STYLE } from './Field';

interface Props {
  value: string[] | undefined;
  onChange: (next: string[]) => void;
  /** 一键填充的默认维度（按 kind 给不同预设：辩论 / 讨论） */
  preset: string[];
  /** chip 配色 token —— 与卡片 chips 同源。kind === debate 用 type-debate-bg/deep；
   *  discuss 用 type-discussion-bg/deep。Field 不知道 kind，由调用方传 */
  chipBg: string;
  chipFg: string;
}

/**
 * 评价维度多 chip 编辑器
 * - 显示当前维度 chips（× 可删）
 * - 输入框回车 / 点击「添加」追加
 * - 「用默认」一键填 preset（覆盖当前）
 *
 * 约束：单条 2-20 字（schema 要求），整体 2-6 条；越界 schema 也会兜住，UI 这里只做软提示。
 */
export function EvalDimensionsInput({ value, onChange, preset, chipBg, chipFg }: Props) {
  const dims = value ?? [];
  const [draft, setDraft] = useState('');
  const max = 6;
  const atCapacity = dims.length >= max;

  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (atCapacity) return;
    if (v.length < 2 || v.length > 20) return; // 软挡住越界
    if (dims.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...dims, v]);
    setDraft('');
  }

  function remove(i: number) {
    onChange(dims.filter((_, idx) => idx !== i));
  }

  function fillPreset() {
    onChange([...preset]);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 现有 chips */}
      {dims.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dims.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-[3px] text-[12px]"
              style={{
                background: chipBg,
                color: chipFg,
                borderRadius: 'var(--radius-xs)',
                border: `1px solid ${chipBg}`,
              }}
            >
              {d}
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-0.5 text-[14px] leading-none transition-opacity hover:opacity-100"
                style={{ color: chipFg, opacity: 0.55 }}
                aria-label={`删除 ${d}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 添加行 */}
      <div className="flex items-center gap-2">
        <input
          className={`${INPUT_CX} flex-1`}
          style={INPUT_STYLE}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={atCapacity ? `已满 ${max} 条` : '输入维度后回车添加，例：论据充分'}
          maxLength={20}
          disabled={atCapacity}
        />
        <button
          type="button"
          onClick={commit}
          className="h-8 shrink-0 px-3 text-[12px] transition-colors"
          style={{
            background: 'var(--color-paper-card)',
            color: 'var(--color-ink-2)',
            border: '1px solid var(--color-paper-edge)',
            borderRadius: 'var(--radius-xs)',
          }}
          disabled={atCapacity || !draft.trim()}
        >
          添加
        </button>
        <button
          type="button"
          onClick={fillPreset}
          className="h-8 shrink-0 px-3 text-[12px] transition-colors"
          style={{
            background: 'var(--color-paper-soft)',
            color: 'var(--color-ink-2)',
            border: '1px solid var(--color-paper-edge)',
            borderRadius: 'var(--radius-xs)',
          }}
          title="用默认 5 项覆盖当前"
        >
          用默认
        </button>
      </div>

      {/* 软提示 */}
      <p
        className="text-[11px]"
        style={{ color: 'var(--color-ink-mute)' }}
      >
        共 {dims.length} 条 · 建议 2-6 条 · 单条 2-20 字
      </p>
    </div>
  );
}
