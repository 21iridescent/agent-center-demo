'use client';

import type { UIMessage } from 'ai';

function extractText(msg: UIMessage): string {
  if (!msg.parts) return '';
  return msg.parts
    .filter(p => p.type === 'text')
    .map(p => (p as { type: 'text'; text: string }).text)
    .join('');
}

interface Props {
  messages: UIMessage[];
  isStreaming?: boolean;
}

export function ChatArea({ messages, isStreaming }: Props) {
  return (
    <div className="flex flex-col gap-[18px] py-2">
      {messages.map(m => {
        const isUser = m.role === 'user';
        const text = extractText(m);
        return (
          <div
            key={m.id}
            className={`flex max-w-[86%] gap-2.5 ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={
                isUser
                  ? { background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }
                  : { background: 'var(--color-bg-gray)', color: 'var(--color-text-3)' }
              }
            >
              {isUser ? '李' : 'AI'}
            </div>
            <div
              className="whitespace-pre-wrap break-words rounded-md px-4 py-3 text-[13px] leading-[1.7]"
              style={
                isUser
                  ? { background: 'var(--color-primary)', color: '#fff' }
                  : {
                      background: '#fff',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }
              }
            >
              {text || (isStreaming && !isUser ? '…' : '')}
            </div>
          </div>
        );
      })}
    </div>
  );
}
