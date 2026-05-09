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
 * - 顶部 3 步进度条让老师一眼明白整个流程
 */

const GREETING =
  '你好。我是「AI 创建」助手——用一句话告诉我你想做个什么智能体（学问 / 辩论 / 讨论 都行），我自动判断类型并出一份草稿；你可以继续聊改它，或直接编辑右侧表单。满意后点右上角「保存」就好。';

/** 整个创建流程的三阶段 —— 顶栏进度条用 + 保存 overlay 用 */
type CreatePhase = 'describe' | 'edit' | 'save';

const STEP_DEFS: { id: CreatePhase; num: string; label: string; desc: string }[] = [
  { id: 'describe', num: '01', label: '描述需求', desc: '一句话告诉 AI 想做什么' },
  { id: 'edit',     num: '02', label: '编辑配置', desc: '对话改 / 表单改，AI 给草稿' },
  { id: 'save',     num: '03', label: '保存使用', desc: '写入智能体库 → 直达使用页' },
];

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

/**
 * 顶部 3 步进度条 —— 老师一眼明白这个页面的工作流。
 * - active 步走深墨色 + 章式底色；其余灰
 * - 步骤之间用一段 paper-rule + chevron，文字带描述（每步 1 句话）
 */
function CreateStepper({ phase }: { phase: CreatePhase }) {
  const activeIdx = STEP_DEFS.findIndex(s => s.id === phase);
  return (
    <ol
      className="flex items-stretch gap-3"
      aria-label="创建流程步骤"
    >
      {STEP_DEFS.map((s, i) => {
        const isActive = i === activeIdx;
        const isPast = i < activeIdx;
        const stateColor = isActive
          ? 'var(--color-paper-stamp)'
          : isPast
            ? 'var(--color-launch-deep)'
            : 'var(--color-ink-mute)';
        return (
          <li
            key={s.id}
            className="flex flex-1 items-center gap-3 border px-4 py-2.5 transition-colors"
            style={{
              background: isActive
                ? 'var(--color-paper-card)'
                : 'var(--color-paper-soft)',
              borderColor: isActive
                ? 'var(--color-paper-stamp)'
                : 'var(--color-paper-edge)',
              borderRadius: 'var(--radius-sm)',
              opacity: isPast ? 0.85 : 1,
            }}
            aria-current={isActive ? 'step' : undefined}
          >
            <span
              className="font-numeric flex h-9 w-9 shrink-0 items-center justify-center text-[13px] font-semibold"
              style={{
                background: isActive
                  ? 'var(--color-paper-stamp)'
                  : isPast
                    ? 'var(--color-launch-bg)'
                    : 'transparent',
                color: isActive
                  ? 'var(--color-paper-base)'
                  : isPast
                    ? 'var(--color-launch-deep)'
                    : 'var(--color-ink-mute)',
                border: isPast || isActive ? 'none' : '1px solid var(--color-paper-edge)',
                borderRadius: 'var(--radius-xs)',
              }}
              aria-hidden
            >
              {isPast ? '✓' : s.num}
            </span>
            <div className="flex flex-col gap-0.5 leading-tight min-w-0">
              <span
                className="font-display text-[14px] font-medium"
                style={{ color: stateColor }}
              >
                {s.label}
              </span>
              <span
                className="text-[11.5px] truncate"
                style={{ color: 'var(--color-ink-mute)' }}
                title={s.desc}
              >
                {s.desc}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 保存进度全屏 overlay —— 给老师阶段化反馈：
 * 1. 写入智能体库 → 2. 跳转到使用页。
 * 不阻断也不可关闭（保存只 ~600ms，redirect 700ms 后触发）。
 */
function SavingOverlay({
  stage,
  agentName,
  kindLabel,
}: {
  stage: 'saving' | 'redirecting' | null;
  agentName: string;
  kindLabel: string;
}) {
  if (!stage) return null;
  const isRedirect = stage === 'redirecting';
  const steps: { label: string; state: 'done' | 'active' | 'pending' }[] = [
    { label: '校验配置完整性', state: 'done' },
    { label: '写入智能体库', state: isRedirect ? 'done' : 'active' },
    { label: '打开使用页', state: isRedirect ? 'active' : 'pending' },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'color-mix(in srgb, var(--color-ink-1) 28%, transparent)' }}
      role="dialog"
      aria-modal="true"
      aria-label="正在保存"
    >
      <div
        className="flex w-full max-w-[420px] flex-col gap-5 border p-6"
        style={{
          background: 'var(--color-paper-card)',
          borderColor: 'var(--color-paper-edge)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        <div className="flex items-baseline gap-2.5">
          <span
            className="font-numeric text-[10.5px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            saving
          </span>
          <span
            className="font-display text-[16px] font-medium"
            style={{ color: 'var(--color-ink-1)' }}
          >
            {isRedirect ? '保存成功' : '正在保存…'}
          </span>
        </div>

        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-ink-2)' }}>
          {isRedirect
            ? `「${agentName}」已写入你的智能体库，马上为你打开 ${kindLabel} 使用页。`
            : `把「${agentName}」写入你的智能体库；写完后会自动打开 ${kindLabel} 使用页。`}
        </p>

        <ol className="flex flex-col gap-2" style={{ color: 'var(--color-ink-2)' }}>
          {steps.map(s => (
            <li key={s.label} className="flex items-center gap-2.5 text-[13px]">
              <span
                className="font-numeric flex h-6 w-6 shrink-0 items-center justify-center text-[11px]"
                style={{
                  background:
                    s.state === 'done'
                      ? 'var(--color-launch-bg)'
                      : s.state === 'active'
                        ? 'var(--color-paper-stamp)'
                        : 'var(--color-paper-soft)',
                  color:
                    s.state === 'done'
                      ? 'var(--color-launch-deep)'
                      : s.state === 'active'
                        ? 'var(--color-paper-base)'
                        : 'var(--color-ink-mute)',
                  border:
                    s.state === 'pending'
                      ? '1px solid var(--color-paper-edge)'
                      : 'none',
                  borderRadius: 'var(--radius-xs)',
                }}
                aria-hidden
              >
                {s.state === 'done' ? '✓' : s.state === 'active' ? '⋯' : '·'}
              </span>
              <span
                style={{
                  color:
                    s.state === 'pending'
                      ? 'var(--color-ink-mute)'
                      : 'var(--color-ink-1)',
                }}
              >
                {s.label}
              </span>
              {s.state === 'active' && (
                <span
                  className="ml-1 inline-flex items-end gap-[2px]"
                  aria-hidden
                >
                  <span
                    className="h-1 w-1 rounded-full animate-bounce [animation-delay:-0.3s]"
                    style={{ background: 'var(--color-ink-mute)' }}
                  />
                  <span
                    className="h-1 w-1 rounded-full animate-bounce [animation-delay:-0.15s]"
                    style={{ background: 'var(--color-ink-mute)' }}
                  />
                  <span
                    className="h-1 w-1 rounded-full animate-bounce"
                    style={{ background: 'var(--color-ink-mute)' }}
                  />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

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
  // 保存阶段化 overlay 状态：null=未保存 / 'saving'=写入中 / 'redirecting'=已写入待跳转
  const [saveStage, setSaveStage] = useState<'saving' | 'redirecting' | null>(null);

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
    setSaveStage('saving');
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: currentKind, config: formState }),
      });
      if (!res.ok) {
        toast('保存失败：服务暂不可用');
        setSaveStage(null);
        return;
      }
      const json: { agent?: { id?: string } } = await res.json();
      const id = json.agent?.id;
      const next =
        currentKind === 'xuewen' && id ? `/use/xuewen/${id}` :
        currentKind === 'debate' && id ? `/use/debate/${id}` :
        '/';
      // 写入成功 → 切到 redirecting 阶段，让 overlay 显示"保存成功，正在打开使用页"
      setSaveStage('redirecting');
      setTimeout(() => router.push(next), 900);
    } catch (e) {
      console.error(e);
      toast('保存失败：网络错误');
      setSaveStage(null);
    } finally {
      setSaving(false);
    }
  }

  const kindColor = currentKind ? KIND_TO_COLOR[currentKind] : null;
  // 当前所处阶段，stepper + overlay 都用：保存进行中走 'save'，已经有草稿走 'edit'，否则 'describe'
  const phase: CreatePhase = saveStage
    ? 'save'
    : currentKind
      ? 'edit'
      : 'describe';
  const saveDisabled = saving || !currentKind;
  const saveTooltip = !currentKind
    ? '先在左侧聊一句，让 AI 生成草稿后才能保存'
    : saving
      ? '正在保存…'
      : '保存到智能体库 → 直接打开使用页';

  return (
    <>
      <Topbar
        crumb="AI 创建"
        showRecordsNav={false}
        right={
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            title={saveTooltip}
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
        className="mx-auto flex w-full flex-col px-10 pt-6 pb-8"
        style={{
          maxWidth: 'min(1560px, calc(100vw - 96px))',
          height: 'calc(100vh - var(--topbar-height))',
        }}
      >
        {/* 流程进度条 —— 老师一进来就明白整个 3 步走 */}
        <header className="mb-6 flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <span
              className="font-numeric text-[11px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              ai workshop
            </span>
            <h1
              className="font-display text-[22px] font-medium leading-none tracking-[0.4px]"
              style={{ color: 'var(--color-ink-1)' }}
            >
              AI 创建智能体
            </h1>
            <span
              className="text-[13px] leading-snug truncate"
              style={{ color: 'var(--color-ink-3)' }}
            >
              {phase === 'describe'
                ? '一句话告诉 AI 你想做什么 — 它会自动判断学问 / 辩论 / 讨论并出草稿'
                : phase === 'edit'
                  ? '右侧已生成配置；继续对话改 / 直接编辑表单都可以'
                  : '正在保存到智能体库…'}
            </span>
          </div>
          <CreateStepper phase={phase} />
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
                      ? '继续告诉 AI 要改什么，例如：把开场白写得活泼点 / 反方立场再激进些'
                      : '一句话写下你想做的智能体（或挑上方任意一张卡片直接开始）'
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
                {/* 顶栏提示带：明确告诉用户两种修改方式都可以 + 提示保存路径 */}
                <div
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-[11.5px] leading-snug"
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
                    两种改法
                  </span>
                  <span>
                    <strong style={{ color: 'var(--color-ink-2)' }}>① 直接改这里</strong> —
                    点字段编辑保存即可
                  </span>
                  <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>·</span>
                  <span>
                    <strong style={{ color: 'var(--color-ink-2)' }}>② 让 AI 重写</strong> —
                    在左侧对话说要改什么，出新草稿后点「应用到表单」覆盖
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

      <SavingOverlay
        stage={saveStage}
        agentName={String((formState as Record<string, unknown>).name ?? '未命名')}
        kindLabel={currentKind ? CREATE_KIND_LABEL[currentKind] : ''}
      />
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
