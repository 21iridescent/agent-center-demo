'use client';

import { useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Topbar } from './Topbar';
import { ChatArea } from './ChatArea';
import { ChatInput } from './ChatInput';

const GREETING =
  '你好。我是「AI 创建」助手——告诉我你想做个什么 agent（学问 / 辩论 / 讨论 都行），我帮你拼好配置，你在卡片里改完点保存就好。';

export function AgentCreatePage() {
  const initialMessages: UIMessage[] = useMemo(
    () => [
      {
        id: 'sys-greet',
        role: 'assistant',
        parts: [{ type: 'text', text: GREETING }],
      } as UIMessage,
    ],
    [],
  );

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/create-agent',
    }),
    messages: initialMessages,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  async function handleSubmit(text: string) {
    await sendMessage({ text });
  }

  return (
    <>
      <Topbar crumb="AI 创建" showRecordsNav={false} />
      <main
        className="mx-auto flex w-full flex-1 flex-col px-6 py-6 pb-12"
        style={{ maxWidth: 'var(--container-wide)' }}
      >
        <section className="flex min-h-[70vh] flex-col gap-3">
          <div
            className="text-[12px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--color-text-4)' }}
          >
            对话区
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChatArea messages={messages} isStreaming={isStreaming} />
          </div>
          <ChatInput
            onSubmit={handleSubmit}
            disabled={isStreaming}
            placeholder="例：给我个三年级讲磁铁的牛顿 / 六年级辩论塑料袋是否禁用 / 四年级讨论班级是否禁带零食"
          />
        </section>
      </main>
    </>
  );
}
