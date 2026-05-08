'use client';

import { useState, useRef, type KeyboardEvent } from 'react';

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSubmit,
  disabled,
  placeholder = '继续输入修改意见、补充需求…（Enter 发送 / Shift+Enter 换行）',
}: Props) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  function send() {
    const v = value.trim();
    if (!v || disabled) return;
    onSubmit(v);
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div
      className="sticky bottom-4 mt-auto flex items-end gap-2.5 rounded-xl border bg-white p-4"
      style={{
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 resize-none border-0 bg-transparent px-2.5 py-2 text-[13px] leading-[1.6] outline-none"
        style={{ color: 'var(--color-text)', maxHeight: 140, minHeight: 40 }}
      />
      <button
        onClick={send}
        disabled={disabled || !value.trim()}
        className="h-9 shrink-0 rounded-md px-5 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: 'var(--color-primary)' }}
      >
        发送
      </button>
    </div>
  );
}
