'use client';

import { useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { Topbar } from './Topbar';
import { ChatArea } from './ChatArea';
import { ChatInput } from './ChatInput';
import { RoleCard } from './RoleCard';
import { useToast } from './Toast';
import type { SavedAgent } from '@/lib/agent-storage';
import {
  getXuewenPersonaResolved,
  getBackground,
} from '@/lib/asset-catalog';
import type { XuewenAgentConfig } from '@/lib/agent-schemas';

interface Props {
  agent: SavedAgent;
}

/**
 * 学问使用页 — 真 AI 角色扮演对话
 *
 * - 左 240px RoleCard（avatar/role/背景/知识库/音色）
 * - 右 useChat 流式对话区（ChatArea + ChatInput）
 * - systemPrompt 客户端拼：含 background + 年级约束 + 单人物口吻
 * - 顶部"结束并保存"→ POST /api/records (DialogueRecord) → 跳 /records
 *
 * 背景图作淡水印 — 不全屏铺，避免污染整站
 */
export function XuewenUsePage({ agent }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const cfg = agent.config as Partial<XuewenAgentConfig>;
  const name = cfg.name ?? '智能体';
  const subject = cfg.subject ?? '科学';
  const grade = cfg.grade ?? '一年级';
  const background = cfg.background ?? '';

  const persona = getXuewenPersonaResolved({
    personaId: cfg.personaId,
    personaCustom: cfg.personaCustom,
    name,
  });
  const bg = getBackground('xuewen', cfg.bgAsset);

  const systemPrompt = useMemo(() => {
    const personaLabel = persona.label ?? name;
    return `你是${name}（原型：${personaLabel}），${background}

对话原则：
- 服务对象是${grade}小学生，用词浅显有比喻，避免学术术语
- 始终保持人物口吻和性格，第一人称
- 单轮回答 80-200 字，避免长篇大论
- 不偏离${subject}学科范围
- 当学生问到你时代之后的事或非本学科话题，礼貌引回主线`;
  }, [name, background, persona.label, grade, subject]);

  const greeting = cfg.coldStart?.trim() || `你好！我是${name}。你想跟我聊点什么？`;

  const initialMessages: UIMessage[] = useMemo(
    () => [
      {
        id: 'sys-greet',
        role: 'assistant',
        parts: [{ type: 'text', text: greeting }],
      } as UIMessage,
    ],
    [greeting],
  );

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/xuewen-chat',
      body: { systemPrompt },
    }),
    messages: initialMessages,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  async function handleSubmit(text: string) {
    await sendMessage({ text });
  }

  function lastTextOf(role: 'user' | 'assistant'): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== role) continue;
      const text = (m.parts ?? [])
        .filter(p => p.type === 'text')
        .map(p => (p as { type: 'text'; text: string }).text)
        .join('');
      if (text) return text;
    }
    return '';
  }

  async function handleEndAndSave() {
    const userTurns = messages.filter(m => m.role === 'user').length;
    if (userTurns === 0) {
      toast('还没说过话，先聊几句再保存');
      return;
    }
    setSaving(true);
    try {
      const lastUser = lastTextOf('user');
      const lastAssistant = lastTextOf('assistant');
      // summary 选最后一句用户问题（更具记忆性："最后一问：xxx"）
      const summaryText = lastUser || lastAssistant;
      const summary = `最后一问：${summaryText.replace(/\s+/g, ' ').slice(0, 50)}`;

      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dialogue',
          title: name,
          summary,
          agentName: name,
          avatar: name.charAt(0),
          avatarUrl: persona.avatarUrl,
          turns: userTurns,
          transcript: { messages },
          meta: {
            agentId: agent.id,
            personaId: cfg.personaId,
            bgAsset: cfg.bgAsset,
            subject,
            grade,
            background,
          },
        }),
      });
      if (!res.ok) {
        toast('保存失败：服务暂不可用');
        return;
      }
      toast('已保存对话到我的记录');
      setTimeout(() => router.push('/records'), 700);
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
        crumb={name}
        showRecordsNav={false}
        right={
          <button
            onClick={handleEndAndSave}
            disabled={saving || isStreaming}
            className="font-display flex h-10 items-center gap-2 px-5 text-[14px] font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'var(--color-paper-stamp)',
              borderRadius: 'var(--radius-sm)',
              letterSpacing: '0.3px',
            }}
          >
            <span aria-hidden style={{ color: 'var(--color-paper-base)', opacity: 0.55 }}>
              ⏏
            </span>
            <span>{saving ? '保存中…' : '结束并保存'}</span>
          </button>
        }
      />
      <main
        className="relative mx-auto flex w-full flex-col px-10 pt-8 pb-8"
        style={{
          maxWidth: 'var(--container-wide)',
          height: 'calc(100vh - var(--topbar-height))',
        }}
      >
        {/* 背景水印（淡）*/}
        {bg && (
          <div
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            style={{ opacity: 0.05 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bg.src}
              alt=""
              className="h-full w-full object-cover"
              aria-hidden
            />
          </div>
        )}

        {/* 章节版口 */}
        <header
          className="mb-6 flex items-end gap-5 border-t pt-5"
          style={{ borderColor: 'var(--color-paper-rule)' }}
        >
          <span
            className="stamp h-10 w-10 shrink-0 text-[12px]"
            style={{
              borderRadius: 'var(--radius-xs)',
              background: 'var(--color-type-dialogue)',
            }}
            aria-hidden
          >
            学
          </span>
          <div className="flex flex-1 items-baseline gap-4 min-w-0">
            <h1
              className="font-display text-[24px] font-medium leading-none tracking-[0.5px]"
              style={{ color: 'var(--color-ink-1)' }}
            >
              和 {name} 对话
            </h1>
            <p
              className="font-numeric text-[11px] uppercase tracking-[0.14em] truncate"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              AI 学问 · {subject} · {grade}
            </p>
          </div>
          <span
            className="font-numeric tnum text-[12px] shrink-0"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            {messages.filter(m => m.role === 'user').length} 轮提问
          </span>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <RoleCard
            name={name}
            subject={subject}
            grade={grade}
            background={background}
            avatarUrl={persona.avatarUrl}
            roleUrl={persona.roleUrl}
            voiceStyle={cfg.voiceStyle}
            knowledgeBases={cfg.knowledgeBases}
          />

          <section
            className="flex min-h-0 flex-col overflow-hidden border"
            style={{
              background: 'var(--color-paper-card)',
              borderColor: 'var(--color-paper-edge)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChatArea messages={messages} isStreaming={isStreaming} />
            </div>
            <div
              className="border-t"
              style={{ borderTopColor: 'var(--color-paper-rule)' }}
            >
              <ChatInput
                onSubmit={handleSubmit}
                disabled={isStreaming}
                placeholder={`问 ${name} 一个问题…`}
              />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
