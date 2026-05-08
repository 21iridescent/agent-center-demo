'use client';

import { Topbar } from './Topbar';
import { ChatArea } from './ChatArea';
import { RoleCard } from './RoleCard';
import { getXuewenPersona } from '@/lib/asset-catalog';
import type { DialogueRecord } from '@/lib/types';

interface Props {
  record: DialogueRecord;
}

/**
 * 学问对话回看 — 只读视图
 *
 * 复用 XuewenUsePage 的双栏（240 RoleCard + ChatArea），但：
 * - 不挂 useChat、不渲染 ChatInput
 * - ChatArea 不传 isStreaming → 内部 ThinkingBubble 关闭
 * - 元数据全部从 record（meta + 顶层字段）拼，不依赖 SavedAgent
 *
 * record 早期保存（无 transcript）时显示空态，不挂
 */
export function DialogueReplayPage({ record }: Props) {
  const messages = record.transcript?.messages ?? [];
  const meta = record.meta ?? {};
  const persona = getXuewenPersona(meta.personaId);

  const name = record.title;
  const subject = meta.subject ?? '科学';
  const grade = meta.grade ?? '一年级';
  const background = meta.background ?? '';
  const userTurns = messages.filter(m => m.role === 'user').length;

  return (
    <>
      <Topbar crumb={`回看 · ${name}`} />
      <main
        className="mx-auto w-full px-6 py-6 pb-12"
        style={{ maxWidth: 'var(--container-wide)' }}
      >
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <RoleCard
            name={name}
            subject={subject}
            grade={grade}
            background={background}
            avatarUrl={persona?.avatar ?? record.avatarUrl}
            roleUrl={persona?.role}
          />

          <section className="flex min-h-[70vh] flex-col gap-3">
            <div
              className="flex items-center justify-between border-b pb-2.5"
              style={{ borderColor: 'var(--color-paper-rule)' }}
            >
              <div
                className="text-[13px] font-semibold"
                style={{ color: 'var(--color-ink-1)' }}
              >
                与{' '}
                <span style={{ color: 'var(--color-type-dialogue-deep)' }}>
                  {name}
                </span>{' '}
                的对话回看
              </div>
              <div
                className="font-numeric tnum text-[11px]"
                style={{ color: 'var(--color-ink-mute)' }}
              >
                {userTurns} 轮提问
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {messages.length > 0 ? (
                <ChatArea messages={messages} />
              ) : (
                <EmptyTranscript hint="该记录无对话原文（早期保存未带 transcript）" />
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function EmptyTranscript({ hint }: { hint: string }) {
  return (
    <div
      className="mx-2 my-6 flex flex-col items-center justify-center gap-2.5 px-6 py-16 text-center"
      style={{
        background: 'var(--color-paper-soft)',
        border: '1px solid var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <span
        className="stamp h-10 w-10 text-[12px]"
        style={{
          borderRadius: 'var(--radius-xs)',
          background: 'var(--color-paper-edge)',
          color: 'var(--color-ink-mute)',
        }}
        aria-hidden
      >
        ø
      </span>
      <div
        className="font-display text-[16px] font-medium"
        style={{ color: 'var(--color-ink-2)' }}
      >
        无可回看内容
      </div>
      <div className="text-[12px]" style={{ color: 'var(--color-ink-3)' }}>
        {hint}
      </div>
    </div>
  );
}
