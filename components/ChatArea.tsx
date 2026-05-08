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

interface DraftRow {
  label: string;
  value: string;
}

function truncate(s: string | undefined, max: number): string {
  if (!s) return '';
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function summarizeDraft(kind: CreateKind, input: unknown): DraftRow[] {
  const cfg = input as Record<string, unknown>;
  const name = String(cfg.name ?? '');
  const subject = String(cfg.subject ?? '');
  const grade = String(cfg.grade ?? '');
  const subjGrade = [subject, grade].filter(Boolean).join(' · ');
  const coldStart = truncate(cfg.coldStart as string, 40);

  if (kind === 'xuewen') {
    const personaId = cfg.personaId as string | undefined;
    const personaCustom = cfg.personaCustom as
      | { sourcePrompt?: string; avatarUrl?: string }
      | undefined;
    const personaLabel = personaCustom
      ? personaCustom.avatarUrl
        ? '⚠ 已生成 AI 形象（在右栏预览）'
        : '⚠ 不在 6 人 catalog · 待 [✨ AI 生成]'
      : personaId
        ? personaId
        : '未指定';
    return [
      { label: '名称', value: name || '(未填)' },
      { label: '学科·年级', value: subjGrade || '(未填)' },
      { label: '背景', value: truncate(cfg.background as string, 56) || '(未填)' },
      { label: '形象', value: personaLabel },
      ...(coldStart ? [{ label: '开场白', value: coldStart }] : []),
    ];
  }
  if (kind === 'debate') {
    const pro = cfg.proSide as { type?: string; argument?: string } | undefined;
    const con = cfg.conSide as { type?: string; argument?: string } | undefined;
    return [
      { label: '名称', value: name || '(未填)' },
      { label: '辩题', value: truncate(cfg.topic as string, 36) || '(未填)' },
      { label: '学科·年级', value: subjGrade || '(未填)' },
      {
        label: '正方',
        value: `${pro?.type ?? '?'} · ${truncate(pro?.argument, 36) || '(未写)'}`,
      },
      {
        label: '反方',
        value: `${con?.type ?? '?'} · ${truncate(con?.argument, 36) || '(未写)'}`,
      },
      ...(coldStart ? [{ label: '开场', value: coldStart }] : []),
    ];
  }
  // discussion
  const scaffolds = cfg.scaffolds as Array<unknown> | undefined;
  return [
    { label: '名称', value: name || '(未填)' },
    { label: '主题', value: truncate(cfg.topic as string, 36) || '(未填)' },
    { label: '学科·年级', value: subjGrade || '(未填)' },
    { label: '主持人', value: String(cfg.hostName ?? '') || '(未填)' },
    { label: '支架', value: `${scaffolds?.length ?? 0} 条` },
    ...(coldStart ? [{ label: '开场', value: coldStart }] : []),
  ];
}

interface Props {
  messages: UIMessage[];
  isStreaming?: boolean;
  /** 已应用的 toolCallId（用于卡片显示"已应用"标识 + 隐藏 Apply 按钮）*/
  appliedToolCallId?: string | null;
  /** 用户点 [应用到表单] 时回调；不传则不显示按钮（兼容 use 页的 ChatArea 复用）*/
  onApplyDraft?: (kind: CreateKind, toolCallId: string, input: unknown) => void;
}

function Avatar({ kind }: { kind: 'user' | 'ai' }) {
  if (kind === 'user') {
    return (
      <span
        aria-hidden
        className="font-numeric flex h-8 w-8 shrink-0 items-center justify-center text-[12px] font-bold"
        style={{
          background: 'var(--color-paper-stamp)',
          color: 'var(--color-paper-base)',
          borderRadius: 'var(--radius-xs)',
        }}
      >
        李
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="font-numeric flex h-8 w-8 shrink-0 items-center justify-center text-[10px] font-bold tracking-[0.05em]"
      style={{
        background: 'var(--color-paper-soft)',
        color: 'var(--color-ink-2)',
        border: '1px solid var(--color-paper-edge)',
        borderRadius: 'var(--radius-xs)',
      }}
    >
      AI
    </span>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex max-w-[86%] gap-3 self-start">
      <Avatar kind="ai" />
      <div
        className="flex items-center gap-2 px-4 py-3 text-[14px]"
        style={{
          background: 'var(--color-paper-card)',
          border: '1px solid var(--color-paper-edge)',
          color: 'var(--color-ink-3)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <span className="flex items-end gap-[3px]">
          <span
            className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.3s]"
            style={{ background: 'var(--color-ink-mute)' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:-0.15s]"
            style={{ background: 'var(--color-ink-mute)' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full animate-bounce"
            style={{ background: 'var(--color-ink-mute)' }}
          />
        </span>
        <span>AI 正在思考…</span>
      </div>
    </div>
  );
}

export function ChatArea({ messages, isStreaming, appliedToolCallId, onApplyDraft }: Props) {
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
    <div className="flex flex-col gap-5 px-5 py-5">
      {messages.map(m => {
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
        const showBubble = text.length > 0;

        return (
          <div key={m.id} className="flex flex-col gap-2.5">
            {!isUser && reasoning.length > 0 && (
              <details
                className="self-start ml-[44px] max-w-[640px] px-4 py-2.5 border"
                style={{
                  background: 'var(--color-paper-soft)',
                  borderColor: 'var(--color-paper-edge)',
                  color: 'var(--color-ink-3)',
                  borderRadius: 'var(--radius-sm)',
                }}
                open={reasoningStreaming}
              >
                <summary className="cursor-pointer text-[12px] font-medium select-none font-numeric uppercase tracking-[0.1em]">
                  思考过程{reasoningStreaming ? '（推理中…）' : ''}
                </summary>
                <pre
                  className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-[1.6]"
                  style={{ fontFamily: 'inherit', color: 'var(--color-ink-3)' }}
                >
                  {reasoning}
                </pre>
              </details>
            )}

            {showBubble && (
              <div
                className={`flex max-w-[86%] gap-3 ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
              >
                <Avatar kind={isUser ? 'user' : 'ai'} />
                <div
                  className="whitespace-pre-wrap break-words px-4 py-3 text-[14px] leading-[1.7]"
                  style={
                    isUser
                      ? {
                          background: 'var(--color-paper-stamp)',
                          color: 'var(--color-paper-base)',
                          borderRadius: 'var(--radius-sm)',
                        }
                      : {
                          background: 'var(--color-paper-card)',
                          border: '1px solid var(--color-paper-edge)',
                          color: 'var(--color-ink-1)',
                          borderRadius: 'var(--radius-sm)',
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
                    className="self-start ml-[44px] inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-numeric uppercase tracking-[0.12em]"
                    style={{
                      background: 'var(--color-paper-soft)',
                      color: 'var(--color-ink-3)',
                      border: '1px solid var(--color-paper-edge)',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-ink-mute)' }} />
                    <span>正在生成 {CREATE_KIND_LABEL[kind]} 草稿</span>
                  </div>
                );
              }

              if (part.state === 'input-available' && part.input && part.toolCallId) {
                const callId = part.toolCallId;
                const isApplied = appliedToolCallId === callId;
                const rows = summarizeDraft(kind, part.input);
                const canApply = !!onApplyDraft && !isApplied;
                return (
                  <div
                    key={callId}
                    className="self-start ml-[44px] flex w-full max-w-[640px] flex-col overflow-hidden border"
                    style={{
                      background: 'var(--color-paper-card)',
                      borderColor: 'var(--color-paper-edge)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div
                      className="flex items-baseline gap-2 border-b px-4 py-2"
                      style={{ borderColor: 'var(--color-paper-rule)' }}
                    >
                      <span
                        className="font-numeric text-[10.5px] uppercase tracking-[0.16em]"
                        style={{ color: 'var(--color-ink-mute)' }}
                      >
                        DRAFT
                      </span>
                      <span
                        className="font-display text-[14px] font-medium"
                        style={{ color: 'var(--color-ink-1)' }}
                      >
                        {CREATE_KIND_LABEL[kind]} 草稿
                      </span>
                      {isApplied && (
                        <span
                          className="ml-auto font-numeric text-[10.5px] uppercase tracking-[0.16em]"
                          style={{ color: 'var(--color-launch-deep)' }}
                        >
                          · 已应用
                        </span>
                      )}
                    </div>

                    <dl
                      className="flex flex-col gap-1.5 px-4 py-3 text-[13px] leading-snug"
                      style={{ color: 'var(--color-ink-1)' }}
                    >
                      {rows.map(r => (
                        <div key={r.label} className="flex gap-3">
                          <dt
                            className="w-[64px] shrink-0 font-numeric text-[11px] uppercase tracking-[0.12em]"
                            style={{ color: 'var(--color-ink-3)' }}
                          >
                            {r.label}
                          </dt>
                          <dd className="flex-1 break-words" style={{ color: 'var(--color-ink-1)' }}>
                            {r.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    {(canApply || isApplied) && (
                      <div
                        className="flex items-center gap-3 border-t px-4 py-2.5"
                        style={{ borderColor: 'var(--color-paper-rule)' }}
                      >
                        {canApply && (
                          <button
                            type="button"
                            onClick={() => onApplyDraft?.(kind, callId, part.input)}
                            className="font-display flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white"
                            style={{
                              background: 'var(--color-paper-stamp)',
                              borderRadius: 'var(--radius-xs)',
                            }}
                          >
                            <span aria-hidden style={{ color: 'var(--color-paper-base)', opacity: 0.6 }}>
                              ▸
                            </span>
                            <span>应用到表单</span>
                          </button>
                        )}
                        <span className="text-[11.5px]" style={{ color: 'var(--color-ink-3)' }}>
                          {isApplied
                            ? '已写入右侧；继续在下方对话框说要改什么，AI 会出新版'
                            : '或在下方对话框继续说要改什么，AI 会出新一版'}
                        </span>
                      </div>
                    )}
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
