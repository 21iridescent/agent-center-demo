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
        className="mx-auto flex w-full flex-1 flex-col gap-5 px-8 py-7 pb-12"
        style={{ maxWidth: '880px' }}
      >
        <ContextStrip
          fields={contextFields}
          onEdit={() => toast('编辑参数功能未实现')}
        />
        <ChatArea messages={messages} isStreaming={isStreaming} />
        <ChatInput onSubmit={handleSubmit} disabled={isStreaming} />
      </main>
    </>
  );
}
