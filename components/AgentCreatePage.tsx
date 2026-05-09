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

/* 冷启动卡片 · 9 个一键例子，覆盖 学问/辩论/讨论 × 小学科学/AI 课程
   prompt 措辞带类型暗示词（"讲"/"辩论"/"讨论"），帮助 AI tool-routing 命中 */
interface Starter {
  kind: CreateKind;
  title: string;
  meta: string;
  prompt: string;
}

const STARTERS: Starter[] = [
  // 学问 · 虚拟人讲解
  { kind: 'xuewen', title: '牛顿讲简单电路', meta: '科学·四年级', prompt: '帮我做个牛顿，给四年级讲简单电路这一课' },
  { kind: 'xuewen', title: '居里夫人讲数据与训练', meta: '人工智能·五年级', prompt: '我想要个居里夫人，给五年级讲数据与训练' },
  { kind: 'xuewen', title: '达尔文讲动物的一生', meta: '科学·三年级', prompt: '请你做个达尔文，三年级讲动物的一生' },
  // 辩论 · 正反对垒
  { kind: 'debate', title: '一次性塑料袋是否禁用', meta: '科学·六年级', prompt: '六年级辩论：一次性塑料袋是否应禁用' },
  { kind: 'debate', title: 'AI 写作业算作弊吗', meta: '人工智能·六年级', prompt: '六年级辩论：用 AI 写作业算不算作弊' },
  { kind: 'debate', title: '校园是否使用人脸识别', meta: '人工智能·六年级', prompt: '六年级辩论：校园是否应使用人脸识别' },
  // 讨论 · 多观点支架
  { kind: 'discussion', title: '月相为什么会变化', meta: '科学·五年级', prompt: '五年级讨论：月相为什么会变化，让大家发表观点' },
  { kind: 'discussion', title: 'AI 推荐视频该不该看', meta: '人工智能·六年级', prompt: '六年级讨论：AI 推荐的视频该不该看' },
  { kind: 'discussion', title: '怎么搭最坚固的纸桥', meta: '科学·六年级', prompt: '六年级讨论：怎么搭一座最坚固的纸桥' },
];

const STARTER_GROUPS: Array<{ kind: CreateKind; label: string }> = [
  { kind: 'xuewen', label: '学问' },
  { kind: 'debate', label: '辩论' },
  { kind: 'discussion', label: '讨论' },
];

function QuickStarters({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div
      className="mx-5 mt-1 mb-2 flex flex-col gap-3 border-t pt-5"
      style={{ borderTopColor: 'var(--color-paper-rule)' }}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="font-numeric text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--color-ink-mute)' }}
        >
          quick start
        </span>
        <span className="text-[12.5px]" style={{ color: 'var(--color-ink-3)' }}>
          不知道写什么？挑一个一键开始
        </span>
      </div>
      {STARTER_GROUPS.map(g => {
        const items = STARTERS.filter(s => s.kind === g.kind);
        const c = KIND_TO_COLOR[g.kind];
        return (
          <div key={g.kind} className="flex items-stretch gap-2.5">
            <span
              className="font-display flex shrink-0 items-center justify-center text-[12px] font-medium"
              style={{
                color: c.deep,
                background: c.bg,
                border: `1px solid ${c.fg}`,
                borderRadius: 'var(--radius-xs)',
                minWidth: 56,
                padding: '4px 8px',
              }}
            >
              {g.label}
            </span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {items.map(s => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => onPick(s.prompt)}
                  className="starter-chip flex flex-col gap-0.5 px-3 py-1.5 text-left transition-colors"
                  style={{
                    background: 'var(--color-paper-card)',
                    border: '1px solid var(--color-paper-edge)',
                    borderRadius: 'var(--radius-xs)',
                  }}
                >
                  <span
                    className="text-[12.5px] font-medium leading-tight"
                    style={{ color: 'var(--color-ink-1)' }}
                  >
                    {s.title}
                  </span>
                  <span
                    className="font-numeric text-[10.5px] uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-ink-mute)' }}
                  >
                    {s.meta}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <style>{`
        .starter-chip:hover {
          background: var(--color-paper-soft) !important;
          border-color: var(--color-paper-stamp) !important;
        }
      `}</style>
    </div>
  );
}

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

  const { messages, sendMessage, status, addToolOutput } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/create-agent',
    }),
    messages: initialMessages,
    /*
     * propose* 三个工具是 HITL（服务端无 execute），LLM 调用后 ToolLoopAgent
     * 直接终止；不补 tool_result 的话下一轮 history 会让 OpenAI/DeepSeek
     * 拒绝（"Tool result is missing for tool call"）。
     * 文档的标准做法：onToolCall 里立刻 addToolOutput 合成 ack——
     * 协议层闭合，UI 层用户照常点"应用到表单"决定写不写入右栏。
     * 不 await：per docs，避免与 streaming 回调死锁。
     */
    onToolCall: ({ toolCall }) => {
      const name = toolCall.toolName;
      if (
        name === 'proposeXuewenAgent' ||
        name === 'proposeDebateAgent' ||
        name === 'proposeDiscussionAgent'
      ) {
        addToolOutput({
          tool: name as never,
          toolCallId: toolCall.toolCallId,
          output: { acknowledged: true },
        });
      }
    },
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
              {currentKind
                ? '右侧已生成配置；继续在左侧对话告诉 AI 改什么，再点应用即可'
                : '和 AI 聊几句，它会自动判断要做什么类型的智能体并生成配置'}
            </p>
          </div>
        </header>

        <div
          className={`grid min-h-0 flex-1 gap-6 ${
            currentKind
              ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
              : 'grid-cols-1'
          }`}
        >
          {/* 左：对话栏（pre-draft 时收窄居中，避免空旷） */}
          <section
            className={`flex min-h-0 flex-col ${
              currentKind ? '' : 'mx-auto w-full max-w-[920px]'
            }`}
          >
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
                {/* 冷启动 chip · 仅 pre-draft 且用户尚未发首条消息时出现 */}
                {!currentKind && messages.length <= 1 && !isStreaming && (
                  <QuickStarters onPick={handleSubmit} />
                )}
              </div>
              <div
                className="border-t"
                style={{ borderTopColor: 'var(--color-paper-rule)' }}
              >
                <ChatInput
                  onSubmit={handleSubmit}
                  disabled={isStreaming}
                  placeholder={
                    currentKind
                      ? '继续告诉 AI 要改什么，例：把开场白写得活泼点 / 反方立场再激进些'
                      : '聊几句你想做的，或挑上面的卡片一键开始'
                  }
                />
              </div>
            </div>
          </section>

          {/* 右：配置（仅在 AI 判断出类型并应用草稿后出现） */}
          {currentKind && (
            <section className="flex min-h-0 flex-col">
              <SectionLabel
                num="02"
                name="配置"
                sub={CREATE_KIND_LABEL[currentKind]}
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
                {/* 顶栏提示带：明确告诉用户表单可被对话再驱动 */}
                <div
                  className="flex items-center gap-2 border-b px-4 py-2 text-[11.5px]"
                  style={{
                    borderBottomColor: 'var(--color-paper-rule)',
                    background: 'var(--color-paper-soft)',
                    color: 'var(--color-ink-3)',
                  }}
                >
                  <span
                    className="font-numeric uppercase tracking-[0.14em]"
                    style={{ color: kindColor?.deep ?? 'var(--color-ink-mute)' }}
                  >
                    tip
                  </span>
                  <span>
                    可直接编辑字段；也可在左侧对话告诉 AI 改什么，会出新一版草稿，再点「应用到表单」覆盖
                  </span>
                </div>
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
          )}
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
