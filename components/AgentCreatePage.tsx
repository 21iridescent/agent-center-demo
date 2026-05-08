'use client';

import { useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { Topbar } from './Topbar';
import { ChatArea } from './ChatArea';
import { ChatInput } from './ChatInput';
import { useToast } from './Toast';
import { XuewenForm } from './AgentForm/Xuewen';
import { DebateForm } from './AgentForm/Debate';
import { DiscussionForm } from './AgentForm/Discussion';
import {
  CREATE_KIND_LABEL,
  type CreateKind,
  type XuewenAgentConfig,
  type DebateAgentConfig,
  type DiscussionAgentConfig,
} from '@/lib/agent-schemas';

/**
 * AI 创建页（统一）· editorial workshop layout
 * - 左对话栏 + 右配置卡，paper-card 物理纸卡
 * - section 标题用 display 字 + 章式编号 + smcp 副标
 */

const GREETING =
  '你好。我是「AI 创建」助手——告诉我你想做个什么 agent（学问 / 辩论 / 讨论 都行），我帮你拼好配置，你在卡片里改完点保存就好。';

type AnyConfig =
  | Partial<XuewenAgentConfig>
  | Partial<DebateAgentConfig>
  | Partial<DiscussionAgentConfig>;

/** kind → 配色 token，仅 type-bound 处使用 */
const KIND_TO_COLOR: Record<CreateKind, { fg: string; bg: string; deep: string }> = {
  xuewen: {
    fg: 'var(--color-type-dialogue)',
    bg: 'var(--color-type-dialogue-bg)',
    deep: 'var(--color-type-dialogue-deep)',
  },
  debate: {
    fg: 'var(--color-type-debate)',
    bg: 'var(--color-type-debate-bg)',
    deep: 'var(--color-type-debate-deep)',
  },
  discussion: {
    fg: 'var(--color-type-discussion)',
    bg: 'var(--color-type-discussion-bg)',
    deep: 'var(--color-type-discussion-deep)',
  },
};

export function AgentCreatePage() {
  const toast = useToast();
  const router = useRouter();
  const [formState, setFormState] = useState<AnyConfig>({});
  const [currentKind, setCurrentKind] = useState<CreateKind | null>(null);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  function handleApplyDraft(kind: CreateKind, toolCallId: string, input: unknown) {
    setCurrentKind(kind);
    setFormState(input as AnyConfig);
    setLastApplied(toolCallId);
    toast(`已应用 ${CREATE_KIND_LABEL[kind]} 草稿到右侧表单`);
  }

  async function handleSave() {
    if (!currentKind) {
      toast('请先在左侧聊几句让 AI 生成草稿');
      return;
    }
    const f = formState as Record<string, unknown>;
    if (!f.name || !f.subject || !f.grade) {
      toast('「名称 / 学科 / 年级」必填');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: currentKind, config: formState }),
      });
      if (!res.ok) {
        toast('保存失败：服务暂不可用');
        return;
      }
      const json: { agent?: { id?: string } } = await res.json();
      const id = json.agent?.id;
      toast(`已保存：${String(f.name)}`);
      const next =
        currentKind === 'xuewen' && id ? `/use/xuewen/${id}` :
        currentKind === 'debate' && id ? `/use/debate/${id}` :
        '/';
      setTimeout(() => router.push(next), 700);
    } catch (e) {
      console.error(e);
      toast('保存失败：网络错误');
    } finally {
      setSaving(false);
    }
  }

  const kindColor = currentKind ? KIND_TO_COLOR[currentKind] : null;

  return (
    <>
      <Topbar
        crumb="AI 创建"
        showRecordsNav={false}
        right={
          <button
            onClick={handleSave}
            disabled={saving || !currentKind}
            className="font-display flex h-10 items-center gap-2 px-5 text-[15px] font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'var(--color-paper-stamp)',
              borderRadius: 'var(--radius-sm)',
              letterSpacing: '0.3px',
            }}
          >
            {saving ? '保存中…' : (
              <>
                <span aria-hidden style={{ color: 'var(--color-paper-base)', opacity: 0.6 }}>
                  ▸
                </span>
                <span>保存</span>
              </>
            )}
          </button>
        }
      />

      <main
        className="mx-auto flex w-full flex-col px-10 pt-8 pb-8"
        style={{
          maxWidth: 'min(1560px, calc(100vw - 96px))',
          height: 'calc(100vh - var(--topbar-height))',
        }}
      >
        {/* 章节版口 · 类似 HomePhase 头部 */}
        <header
          className="mb-8 flex items-end gap-5 border-t pt-5"
          style={{ borderColor: 'var(--color-paper-rule)' }}
        >
          <span
            className="stamp h-10 w-10 shrink-0 text-[14px]"
            style={{ borderRadius: 'var(--radius-xs)' }}
            aria-hidden
          >
            NEW
          </span>
          <div className="flex flex-1 items-baseline gap-4 min-w-0">
            <h1
              className="font-display text-[28px] font-medium leading-none tracking-[0.5px]"
              style={{ color: 'var(--color-ink-1)' }}
            >
              {currentKind ? `配置 · ${CREATE_KIND_LABEL[currentKind]}` : '从对话开始'}
            </h1>
            <p
              className="text-[14px] leading-snug truncate"
              style={{ color: 'var(--color-ink-3)' }}
            >
              和 AI 聊几句，它会自动判断你要做什么类型的智能体
            </p>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* 左：对话栏 */}
          <section className="flex min-h-0 flex-col">
            <SectionLabel num="01" name="对话" sub="describe" />
            <div
              className="flex flex-1 flex-col overflow-hidden border"
              style={{
                background: 'var(--color-paper-card)',
                borderColor: 'var(--color-paper-edge)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ChatArea
                  messages={messages}
                  isStreaming={isStreaming}
                  appliedToolCallId={lastApplied}
                  onApplyDraft={handleApplyDraft}
                />
              </div>
              <div
                className="border-t"
                style={{ borderTopColor: 'var(--color-paper-rule)' }}
              >
                <ChatInput
                  onSubmit={handleSubmit}
                  disabled={isStreaming}
                  placeholder="例：给我个三年级讲磁铁的牛顿 / 六年级辩论塑料袋是否禁用 / 四年级讨论班级是否禁带零食"
                />
              </div>
            </div>
          </section>

          {/* 右：配置 */}
          <section className="flex min-h-0 flex-col">
            <SectionLabel
              num="02"
              name="配置"
              sub={currentKind ? CREATE_KIND_LABEL[currentKind] : '等待中'}
              accent={kindColor?.deep}
            />
            <div
              className="flex flex-1 flex-col overflow-hidden border"
              style={{
                background: 'var(--color-paper-card)',
                borderColor: 'var(--color-paper-edge)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {!currentKind && (
                <div
                  className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center"
                  style={{ background: 'var(--color-paper-soft)' }}
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
                    ?
                  </span>
                  <div
                    className="font-display text-[18px] font-medium"
                    style={{ color: 'var(--color-ink-2)' }}
                  >
                    等 AI 判断类型
                  </div>
                  <div
                    className="text-[13px] leading-relaxed max-w-[360px]"
                    style={{ color: 'var(--color-ink-3)' }}
                  >
                    告诉它「牛顿讲磁铁」/「辩论塑料袋」/「讨论零食」等，
                    它会自动选择 学问 / 辩论 / 讨论 表单
                  </div>
                </div>
              )}
              {currentKind === 'xuewen' && (
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <XuewenForm
                    value={formState as Partial<XuewenAgentConfig>}
                    onChange={v => setFormState(v)}
                  />
                </div>
              )}
              {currentKind === 'debate' && (
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <DebateForm
                    value={formState as Partial<DebateAgentConfig>}
                    onChange={v => setFormState(v)}
                  />
                </div>
              )}
              {currentKind === 'discussion' && (
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <DiscussionForm
                    value={formState as Partial<DiscussionAgentConfig>}
                    onChange={v => setFormState(v)}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

interface SectionLabelProps {
  num: string;
  name: string;
  sub: string;
  accent?: string;
}

/** 卡片上方 section 标识 · 编号 · 名 · smcp 副标 */
function SectionLabel({ num, name, sub, accent }: SectionLabelProps) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <span
        className="font-numeric text-[12px] tnum"
        style={{ color: 'var(--color-ink-mute)' }}
      >
        {num}
      </span>
      <span
        className="font-display text-[16px] font-medium leading-none"
        style={{ color: 'var(--color-ink-1)' }}
      >
        {name}
      </span>
      <span
        className="font-numeric text-[11px] uppercase tracking-[0.14em]"
        style={{ color: accent ?? 'var(--color-ink-mute)' }}
      >
        {sub}
      </span>
    </div>
  );
}
