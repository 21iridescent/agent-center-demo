'use client';

import type { UIMessage } from 'ai';
import { AgentInlineFormCard } from './AgentInlineFormCard';
import { CREATE_KIND_LABEL, type CreateKind } from '@/lib/agent-schemas';

interface ToolPart {
  type: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
}

function kindFromToolType(type: string): CreateKind | null {
  if (type === 'tool-proposeXuewenAgent') return 'xuewen';
  if (type === 'tool-proposeDebateAgent') return 'debate';
  if (type === 'tool-proposeDiscussionAgent') return 'discussion';
  return null;
}

interface Props {
  messages: UIMessage[];
  isStreaming?: boolean;
}

export function ChatArea({ messages, isStreaming }: Props) {
  return (
    <div className="flex flex-col gap-[18px] py-2">
      {messages.map((m, mi) => {
        const isUser = m.role === 'user';
        const text = (m.parts ?? [])
          .filter(p => p.type === 'text')
          .map(p => (p as { type: 'text'; text: string }).text)
          .join('');
        const toolParts = (m.parts ?? []).filter(p =>
          p.type.startsWith('tool-'),
        ) as ToolPart[];
        const isLast = mi === messages.length - 1;
        const showBubble = text.length > 0 || (isLast && isStreaming && !isUser);

        return (
          <div key={m.id} className="flex flex-col gap-3">
            {showBubble && (
              <div
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
                  {text || '…'}
                </div>
              </div>
            )}

            {toolParts.map(part => {
              const kind = kindFromToolType(part.type);
              if (!kind) return null;
              if (part.state === 'input-streaming') {
                return (
                  <div
                    key={part.toolCallId ?? `${m.id}-${part.type}`}
                    className="self-start ml-[38px] rounded-md px-3 py-2 text-[12px]"
                    style={{
                      background: 'var(--color-bg-gray)',
                      color: 'var(--color-text-3)',
                    }}
                  >
                    正在生成 {CREATE_KIND_LABEL[kind]} 草稿…
                  </div>
                );
              }
              if (part.state === 'input-available' && part.input && part.toolCallId) {
                return (
                  <div
                    key={part.toolCallId}
                    className="self-start ml-[38px] w-full max-w-[640px]"
                  >
                    <AgentInlineFormCard
                      toolCallId={part.toolCallId}
                      kind={kind}
                      initial={part.input}
                    />
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      })}
    </div>
  );
}
