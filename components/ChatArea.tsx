'use client';

import type { UIMessage } from 'ai';
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

function ThinkingBubble() {
  return (
    <div className="flex max-w-[86%] gap-2.5 self-start">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: 'var(--color-bg-gray)', color: 'var(--color-text-3)' }}
      >
        AI
      </div>
      <div
        className="flex items-center gap-2 rounded-md px-4 py-3 text-[13px]"
        style={{
          background: '#fff',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-3)',
        }}
      >
        <span className="flex items-end gap-[3px]">
          <span
            className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.3s]"
            style={{ background: 'var(--color-text-5)' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.15s]"
            style={{ background: 'var(--color-text-5)' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full animate-bounce"
            style={{ background: 'var(--color-text-5)' }}
          />
        </span>
        <span>AI 正在思考…</span>
      </div>
    </div>
  );
}

export function ChatArea({ messages, isStreaming }: Props) {
  // Loading 触发条件：① 等首 token 中（status='submitted'，messages 末尾还是 user）
  // ② 已 streaming 但 assistant 还没出文字也没出 tool part（极短瞬间）
  const last = messages[messages.length - 1];
  const lastHasContent = last
    ? (last.parts ?? []).some(p => {
        if (p.type === 'text' && (p as { text: string }).text.length > 0) return true;
        if (p.type === 'reasoning' && (p as { text: string }).text.length > 0) return true;
        if (p.type.startsWith('tool-')) return true;
        return false;
      })
    : false;
  const showThinking = !!isStreaming && (!last || last.role === 'user' || !lastHasContent);

  return (
    <div className="flex flex-col gap-[18px] py-2">
      {messages.map((m, mi) => {
        const isUser = m.role === 'user';
        const text = (m.parts ?? [])
          .filter(p => p.type === 'text')
          .map(p => (p as { type: 'text'; text: string }).text)
          .join('');
        const reasoning = (m.parts ?? [])
          .filter(p => p.type === 'reasoning')
          .map(p => (p as { type: 'reasoning'; text: string }).text)
          .join('');
        const reasoningStreaming = (m.parts ?? []).some(
          p =>
            p.type === 'reasoning' &&
            (p as { state?: 'streaming' | 'done' }).state === 'streaming',
        );
        const toolParts = (m.parts ?? []).filter(p =>
          p.type.startsWith('tool-'),
        ) as ToolPart[];
        // 文字非空才展示文本气泡（空 + 流中"…"占位的情况由底部独立 ThinkingBubble 接管）
        const showBubble = text.length > 0;

        return (
          <div key={m.id} className="flex flex-col gap-3">
            {!isUser && reasoning.length > 0 && (
              <details
                className="self-start ml-[38px] max-w-[640px] rounded-md border px-3 py-2"
                style={{
                  background: 'var(--color-bg-gray)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-3)',
                }}
                open={reasoningStreaming}
              >
                <summary className="cursor-pointer text-[12px] font-medium select-none">
                  💭 思考过程{reasoningStreaming ? '（推理中…）' : ''}
                </summary>
                <pre
                  className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-[1.6]"
                  style={{ fontFamily: 'inherit', color: 'var(--color-text-4)' }}
                >
                  {reasoning}
                </pre>
              </details>
            )}
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
                  {text}
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
                // 表单本体在右栏（AgentCreatePage / AgentTemplateCreatePage）渲染；
                // chat 里只留个小标签做"已生成"提示，避免左右双重表单
                return (
                  <div
                    key={part.toolCallId}
                    className="self-start ml-[38px] inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium"
                    style={{
                      background: 'var(--color-primary-bg)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    <span>✓</span>
                    <span>{CREATE_KIND_LABEL[kind]} 草稿已生成 — 请在右侧表单查看 / 修改 / 保存</span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      })}
      {showThinking && <ThinkingBubble />}
    </div>
  );
}
