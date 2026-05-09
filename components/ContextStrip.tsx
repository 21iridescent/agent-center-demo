'use client';

import { useState } from 'react';

export interface ContextField {
  label: string;
  value: string;
  /** 可选：固定可选项（select）；不传则普通 input */
  options?: string[];
}

export interface ContextParam {
  key: string;
  label: string;
  value: string;
  options?: string[];
}

interface Props {
  fields: ContextField[];
  /** 选填的次级参数（长度/难度/时长等）；与 fields 同一行 */
  params?: ContextParam[];
  /** 切到编辑模式后，每次改动单字段都会回调（受控） */
  onFieldChange?: (label: string, next: string) => void;
  onParamChange?: (key: string, next: string) => void;
  /** 不传 onEdit 时不显示"改参数"按钮（保持现有 readonly 行为） */
  onEdit?: () => void;
  /** 受控编辑模式开关；不传 = 永远 readonly */
  editing?: boolean;
  onEditDone?: () => void;
}

/**
 * 备课工具页 · 上下文条
 * - readonly 模式：smcp 标签 + display 值（旧行为）
 * - editing 模式：每个 field 变成 input（或 select，如果有 options）
 *   原地切换，不开 modal——CLAUDE.md design principle 1 paper-over-chrome
 */
export function ContextStrip({
  fields,
  params = [],
  onFieldChange,
  onParamChange,
  onEdit,
  editing = false,
  onEditDone,
}: Props) {
  // 内部 fallback：父组件不提供 editing 时给一个本地切换（debug 用）
  const [internalEditing, setInternalEditing] = useState(false);
  const isEditing = onEditDone ? editing : internalEditing;

  const handleEditClick = () => {
    if (onEdit) onEdit();
    else setInternalEditing(e => !e);
  };

  if (isEditing) {
    return (
      <div
        className="flex flex-col gap-3 border px-5 py-3"
        style={{
          background: 'var(--color-paper-card)',
          borderColor: 'var(--color-paper-edge)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2.5">
          {fields.map(f => (
            <FieldEditor
              key={f.label}
              label={f.label}
              value={f.value}
              options={f.options}
              onChange={next => onFieldChange?.(f.label, next)}
            />
          ))}
          {params.map(p => (
            <FieldEditor
              key={p.key}
              label={p.label}
              value={p.value}
              options={p.options}
              onChange={next => onParamChange?.(p.key, next)}
            />
          ))}
          <button
            onClick={() => (onEditDone ? onEditDone() : setInternalEditing(false))}
            className="font-numeric ml-auto px-3 py-1 text-[11px] uppercase tracking-[0.14em]"
            style={{
              background: 'var(--color-paper-stamp)',
              color: 'var(--color-paper-base)',
              borderRadius: 'var(--radius-xs)',
            }}
          >
            完成
          </button>
        </div>
      </div>
    );
  }

  // readonly 模式（与改造前等价）
  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2 border px-5 py-3"
      style={{
        background: 'var(--color-paper-card)',
        borderColor: 'var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {fields.map((f, i) => (
        <span key={f.label} className="flex items-baseline gap-2.5">
          <span
            className="font-numeric text-[10px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            {f.label}
          </span>
          <span
            className="font-display text-[14px] font-medium"
            style={{ color: 'var(--color-ink-1)' }}
          >
            {f.value}
          </span>
          {i < fields.length - 1 && (
            <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>·</span>
          )}
        </span>
      ))}
      {params.length > 0 && (
        <>
          <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>·</span>
          {params.map((p, i) => (
            <span key={p.key} className="flex items-baseline gap-2.5">
              <span
                className="font-numeric text-[10px] uppercase tracking-[0.14em]"
                style={{ color: 'var(--color-ink-mute)' }}
              >
                {p.label}
              </span>
              <span
                className="font-display text-[14px] font-medium"
                style={{ color: 'var(--color-ink-1)' }}
              >
                {p.value}
              </span>
              {i < params.length - 1 && (
                <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>·</span>
              )}
            </span>
          ))}
        </>
      )}
      {(onEdit || onEditDone) && (
        <button
          onClick={handleEditClick}
          className="font-numeric ml-auto px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] transition-colors hover:[color:var(--color-ink-1)]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          改参数
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

interface FieldEditorProps {
  label: string;
  value: string;
  options?: string[];
  onChange: (next: string) => void;
}

function FieldEditor({ label, value, options, onChange }: FieldEditorProps) {
  const labelEl = (
    <span
      className="font-numeric text-[10px] uppercase tracking-[0.14em]"
      style={{ color: 'var(--color-ink-mute)' }}
    >
      {label}
    </span>
  );

  return (
    <label className="flex items-baseline gap-2">
      {labelEl}
      {options ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="font-display bg-transparent text-[14px] font-medium outline-none"
          style={{
            color: 'var(--color-ink-1)',
            borderBottom: '1px solid var(--color-paper-rule)',
            paddingBottom: 1,
          }}
        >
          {options.map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="font-display bg-transparent text-[14px] font-medium outline-none"
          style={{
            color: 'var(--color-ink-1)',
            borderBottom: '1px solid var(--color-paper-rule)',
            paddingBottom: 1,
            minWidth: 80,
          }}
        />
      )}
    </label>
  );
}
