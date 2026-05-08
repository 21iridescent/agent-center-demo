'use client';

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * 聊天输入栏 · 无外框（容器决定 chrome）
 * - 文本区透明 + auto-grow
 * - 发送按钮 paper-stamp filled
 */
export function ChatInput({
  onSubmit,
  disabled,
  placeholder = '继续输入修改意见、补充需求…（Enter 发送 / Shift+Enter 换行）',
}: Props) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // auto-grow
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [value]);

  function send() {
    const v = value.trim();
    if (!v || disabled) return;
    onSubmit(v);
    setValue('');
  }

  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div
      className="flex items-end gap-3 px-5 py-4 transition-colors"
      style={{
        background: focused ? 'var(--color-paper-card)' : 'var(--color-paper-card)',
        borderTop: focused
          ? '1px solid var(--color-paper-stamp)'
          : '1px solid transparent',
        marginTop: focused ? -1 : 0,
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        className="chat-textarea flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[14px] leading-[1.7] outline-none"
        style={{
          color: 'var(--color-ink-1)',
          maxHeight: 140,
          minHeight: 28,
          overflowY: 'auto',
        }}
      />
      <button
        onClick={send}
        disabled={!canSend}
        className="font-display flex h-10 shrink-0 items-center gap-2 px-5 text-[14px] font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-30"
        style={{
          background: 'var(--color-paper-stamp)',
          borderRadius: 'var(--radius-sm)',
          letterSpacing: '0.3px',
        }}
      >
        <span aria-hidden style={{ color: 'var(--color-paper-base)', opacity: 0.55 }}>
          ↵
        </span>
        <span>发送</span>
      </button>
      {/* 占位色 + scrollbar 仅作用于此输入 */}
      <style>{`
        .chat-textarea::placeholder {
          color: var(--color-ink-mute);
          opacity: 1;
        }
        .chat-textarea {
          scrollbar-width: thin;
          scrollbar-color: var(--color-paper-edge) transparent;
        }
      `}</style>
    </div>
  );
}
