'use client';

import { useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Topbar } from './Topbar';
import { ContextStrip } from './ContextStrip';
import { ChatArea } from './ChatArea';
import { ChatInput } from './ChatInput';
import { SaveButton } from './SaveButton';
import { useToast } from './Toast';
import type { PrepKind } from '@/lib/types';
import { PREP_KIND_TITLE_SUFFIX } from '@/lib/types';

interface Props {
  toolName: string;
  kind: PrepKind;
  contextFields: { label: string; value: string }[];
  /** 用于生成保存标题：'水的三态变化' → '水的三态变化课件大纲' */
  saveTitleStem: string;
  initialMessages: { id: string; role: 'user' | 'assistant'; text: string }[];
}

function toUIMessages(seeds: Props['initialMessages']): UIMessage[] {
  return seeds.map(s => ({
    id: s.id,
    role: s.role,
    parts: [{ type: 'text', text: s.text }],
  })) as UIMessage[];
}

function lastAssistantText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const text = (m.parts ?? [])
      .filter(p => p.type === 'text')
      .map(p => (p as { type: 'text'; text: string }).text)
      .join('');
    if (text) return text;
  }
  return '';
}

const KIND_LABEL: Record<PrepKind, string> = {
  lesson:   '教学设计',
  exercise: '习题出题',
  activity: '课堂活动',
  outline:  '课件大纲',
};

export function PrepToolPage({
  toolName,
  kind,
  contextFields,
  saveTitleStem,
  initialMessages,
}: Props) {
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/generate',
      body: { kind },
    }),
    messages: toUIMessages(initialMessages),
  });

  useEffect(() => {
    if (saved) setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const isStreaming = status === 'streaming' || status === 'submitted';

  async function handleSubmit(text: string) {
    await sendMessage({ text });
  }

  async function handleSave() {
    const content = lastAssistantText(messages);
    if (!content) {
      toast('还没有内容可保存');
      return;
    }
    setSaving(true);
    try {
      const title = `${saveTitleStem}${PREP_KIND_TITLE_SUFFIX[kind]}`;
      const meta: Record<string, string> = {};
      contextFields.forEach(f => { meta[f.label] = f.value; });
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'prep',
          kind,
          title,
          summary: content.replace(/\s+/g, ' ').slice(0, 60),
          agentName: toolName,
          avatar: title.charAt(0),
          meta,
          content,
        }),
      });
      if (!res.ok) {
        toast('保存失败：服务暂不可用');
        return;
      }
      setSaved(true);
      toast(`已保存：${title}`);
    } catch (e) {
      console.error(e);
      toast('保存失败：网络错误');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Topbar
        crumb={toolName}
        showRecordsNav={false}
        right={<SaveButton saved={saved} saving={saving} onSave={handleSave} />}
      />
      <main
        className="mx-auto flex w-full flex-col px-10 pt-8 pb-8"
        style={{
          maxWidth: 'var(--container-form)',
          height: 'calc(100vh - var(--topbar-height))',
        }}
      >
        {/* 章节版口 · stamp + 工具名 + smcp kind */}
        <header
          className="mb-6 flex items-end gap-5 border-t pt-5"
          style={{ borderColor: 'var(--color-paper-rule)' }}
        >
          <span
            className="stamp h-10 w-10 shrink-0 text-[12px]"
            style={{ borderRadius: 'var(--radius-xs)' }}
            aria-hidden
          >
            {kind.slice(0, 3).toUpperCase()}
          </span>
          <div className="flex flex-1 items-baseline gap-4 min-w-0">
            <h1
              className="font-display text-[24px] font-medium leading-none tracking-[0.5px]"
              style={{ color: 'var(--color-ink-1)' }}
            >
              {toolName}
            </h1>
            <p
              className="font-numeric text-[11px] uppercase tracking-[0.14em] truncate"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              {KIND_LABEL[kind]}
            </p>
          </div>
        </header>

        <div className="mb-5">
          <ContextStrip
            fields={contextFields}
            onEdit={() => toast('编辑参数功能未实现')}
          />
        </div>

        {/* 对话/输出区 paper-card · 包 ChatArea + ChatInput */}
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden border"
          style={{
            background: 'var(--color-paper-card)',
            borderColor: 'var(--color-paper-edge)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ChatArea messages={messages} isStreaming={isStreaming} />
          </div>
          <div
            className="border-t"
            style={{ borderTopColor: 'var(--color-paper-rule)' }}
          >
            <ChatInput onSubmit={handleSubmit} disabled={isStreaming} />
          </div>
        </div>
      </main>
    </>
  );
}
