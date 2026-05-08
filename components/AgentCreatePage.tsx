'use client';

import { useEffect, useMemo, useState } from 'react';
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
  CREATE_TOOL_NAME,
  type CreateKind,
  type XuewenAgentConfig,
  type DebateAgentConfig,
  type DiscussionAgentConfig,
} from '@/lib/agent-schemas';

type AnyConfig =
  | Partial<XuewenAgentConfig>
  | Partial<DebateAgentConfig>
  | Partial<DiscussionAgentConfig>;

interface Props {
  kind: CreateKind;
}

const GREETING: Record<CreateKind, string> = {
  xuewen:
    '你好。我帮你配一个 AI 学问智能体。先告诉我：要谁来回答（人物原型）？讲什么学科？给几年级用？',
  debate:
    '你好。我帮你配一个 AI 辩论智能体。先告诉我：辩题是什么？给几年级？正反方是 AI vs AI / AI vs 学生 / 学生 vs 学生？',
  discussion:
    '你好。我帮你配一个 AI 讨论智能体。先告诉我：讨论主题、几年级、想用多长时间？',
};

interface ToolPart {
  type: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
}

function findLatestToolCall(
  messages: UIMessage[],
  toolName: string,
): { id: string; input: unknown } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    for (const p of m.parts ?? []) {
      const part = p as ToolPart;
      if (part.type === `tool-${toolName}` && part.input && part.toolCallId) {
        return { id: part.toolCallId, input: part.input };
      }
    }
  }
  return null;
}

export function AgentCreatePage({ kind }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [formState, setFormState] = useState<AnyConfig>({});
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const initialMessages: UIMessage[] = useMemo(
    () => [
      {
        id: 'sys-greet',
        role: 'assistant',
        parts: [{ type: 'text', text: GREETING[kind] }],
      } as UIMessage,
    ],
    [kind],
  );

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/create-agent',
      body: { kind },
    }),
    messages: initialMessages,
  });

  // 监听 AI 工具调用 — 新 toolCallId 出现时把 input 灌进表单
  useEffect(() => {
    const call = findLatestToolCall(messages, CREATE_TOOL_NAME[kind]);
    if (call && call.id !== lastApplied) {
      setFormState(call.input as AnyConfig);
      setLastApplied(call.id);
      toast('AI 已生成配置，可在右侧表单修改');
    }
  }, [messages, kind, lastApplied, toast]);

  const isStreaming = status === 'streaming' || status === 'submitted';

  async function handleSubmit(text: string) {
    await sendMessage({ text });
  }

  async function handleSave() {
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
        body: JSON.stringify({ kind, config: formState }),
      });
      if (!res.ok) {
        toast('保存失败：服务暂不可用');
        return;
      }
      toast(`已保存：${String(f.name)}`);
      setTimeout(() => router.push('/'), 700);
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
        crumb={`新建 ${CREATE_KIND_LABEL[kind]}`}
        showRecordsNav={false}
        right={
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 rounded-md px-4 text-[13px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}
          >
            {saving ? '保存中…' : '保存到我的智能体'}
          </button>
        }
      />
      <main
        className="mx-auto w-full flex-1 px-6 py-6 pb-12"
        style={{ maxWidth: 'var(--container-wide)' }}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          {/* 左：聊天 */}
          <section className="flex min-h-[60vh] flex-col gap-3">
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
              placeholder={
                kind === 'xuewen'
                  ? '例：我要个三年级讲磁铁的牛顿智能体'
                  : kind === 'debate'
                  ? '例：六年级辩论一次性塑料袋是否应该禁用'
                  : '例：四年级讨论班级是否应禁止带零食，30 分钟'
              }
            />
          </section>

          {/* 右：表单 */}
          <section className="flex flex-col gap-3">
            <div
              className="text-[12px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--color-text-4)' }}
            >
              {lastApplied ? '配置（AI 已预填，可改）' : '配置（先在左侧聊几句让 AI 生成）'}
            </div>
            {kind === 'xuewen' && (
              <XuewenForm
                value={formState as Partial<XuewenAgentConfig>}
                onChange={v => setFormState(v)}
              />
            )}
            {kind === 'debate' && (
              <DebateForm
                value={formState as Partial<DebateAgentConfig>}
                onChange={v => setFormState(v)}
              />
            )}
            {kind === 'discussion' && (
              <DiscussionForm
                value={formState as Partial<DiscussionAgentConfig>}
                onChange={v => setFormState(v)}
              />
            )}
          </section>
        </div>
      </main>
    </>
  );
}
