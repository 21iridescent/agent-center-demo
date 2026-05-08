'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { HomePhase } from '@/components/HomePhase';
import { ToolCard } from '@/components/ToolCard';
import { AgentCard, type AgentType } from '@/components/AgentCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';

interface AgentSeed {
  id: string;
  type: AgentType;
  avatar: string;
  name: string;
  subject: string;
  grade: string;
  lastUsed: string;
  launchHref: string;
  editHref: string;
}

const TOOLS = [
  {
    icon: '🗺',
    name: '教学设计助手',
    desc: '输入课题与学情，生成完整教学环节与时间分配',
    tags: ['教案', '活动设计'],
    href: '/prep/lesson',
  },
  {
    icon: '📝',
    name: '习题智能出题',
    desc: '按知识点、难度、题型生成练习题，支持多题型',
    tags: ['出题', '分层练习'],
    href: '/prep/exercise',
  },
  {
    icon: '🎯',
    name: '课堂活动生成',
    desc: '按教学目标推荐活动形式，附说明与评估标准',
    tags: ['活动', '评估'],
    href: '/prep/activity',
  },
  {
    icon: '📊',
    name: '课件大纲规划',
    desc: '按教材内容快速生成课件骨架，分页与重点标注',
    tags: ['课件', '结构'],
    href: '/prep/outline',
  },
];

const INITIAL_AGENTS: AgentSeed[] = [
  {
    id: 'a1',
    type: 'discuss',
    avatar: '水',
    name: '水的三态变化',
    subject: '科学',
    grade: '三年级',
    lastUsed: '昨天',
    launchHref: '/legacy/AI思辨使用-讨论-v0.1.html',
    editHref: '/legacy/AI思辨创建-讨论-v0.1.html',
  },
  {
    id: 'a2',
    type: 'dialogue',
    avatar: '像',
    name: '机器如何识别图像',
    subject: '人工智能',
    grade: '五年级',
    lastUsed: '3 天前',
    launchHref: '/legacy/AI学问使用-v0.1.html',
    editHref: '/legacy/AI学问创建-v0.1.html',
  },
  {
    id: 'a3',
    type: 'debate',
    avatar: '判',
    name: 'AI 该有自己判断吗',
    subject: '人工智能',
    grade: '六年级',
    lastUsed: '上周',
    launchHref: '/legacy/AI思辨使用-辩论-v0.1.html',
    editHref: '/legacy/AI思辨创建-辩论-v0.1.html',
  },
  {
    id: 'a4',
    type: 'discuss',
    avatar: '磁',
    name: '磁铁的两极',
    subject: '科学',
    grade: '二年级',
    lastUsed: '2 周前',
    launchHref: '/legacy/AI思辨使用-讨论-v0.1.html',
    editHref: '/legacy/AI思辨创建-讨论-v0.1.html',
  },
];

const QUICK_NEW = [
  { type: 'dialogue' as const, label: '学问', href: '/legacy/AI学问创建-v0.1.html' },
  { type: 'debate'   as const, label: '辩论', href: '/legacy/AI思辨创建-辩论-v0.1.html' },
  { type: 'discuss'  as const, label: '讨论', href: '/legacy/AI思辨创建-讨论-v0.1.html' },
];

const TYPE_DOT_COLOR: Record<AgentType, string> = {
  dialogue: 'var(--color-primary)',
  debate:   'var(--color-debate)',
  discuss:  'var(--color-discussion)',
};

export default function Home() {
  const toast = useToast();
  const [agents, setAgents] = useState<AgentSeed[]>(INITIAL_AGENTS);
  const [manageMode, setManageMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AgentSeed | null>(null);

  function confirmDelete() {
    if (!pendingDelete) return;
    setAgents(prev => prev.filter(a => a.id !== pendingDelete.id));
    toast(`已删除：${pendingDelete.name}`);
    setPendingDelete(null);
  }

  return (
    <>
      <Topbar />
      <main className="mx-auto w-full px-8 pt-10 pb-24" style={{ maxWidth: 'var(--container-wide)' }}>
        {/* ① 备课 */}
        <HomePhase
          num="①"
          title="备课"
          sub="平台 AI 工具，把课备扎实"
          actions={
            <button
              onClick={() => toast('暂未开放')}
              className="text-[13px] transition-colors hover:underline"
              style={{ color: 'var(--color-text-3)' }}
            >
              查看全部 →
            </button>
          }
        >
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {TOOLS.map(t => (
              <ToolCard key={t.name} {...t} />
            ))}
          </div>
        </HomePhase>

        {/* ② 授课 */}
        <HomePhase
          num="②"
          title="授课"
          sub={manageMode ? '管理模式 · 可编辑或删除你的智能体' : '我配置好的，随时启动'}
          meta={!manageMode && `共 ${agents.length} 个`}
          actions={
            manageMode ? (
              <button
                onClick={() => setManageMode(false)}
                className="h-7 rounded-full border px-4 text-[12px] transition-colors"
                style={{
                  background: 'var(--color-success)',
                  color: '#fff',
                  borderColor: 'var(--color-success)',
                }}
              >
                完成
              </button>
            ) : (
              <>
                <Link
                  href="/legacy/模板选择-v0.1.html"
                  className="text-[13px] transition-colors hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  ＋ 新建
                </Link>
                <button
                  onClick={() => setManageMode(true)}
                  className="h-7 rounded-full border bg-white px-4 text-[12px] transition-colors hover:[border-color:var(--color-primary)] hover:[color:var(--color-primary)]"
                  style={{
                    color: 'var(--color-text-3)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  管理
                </button>
              </>
            )
          }
        >
          {/* 类型快建 pill 行（管理态隐藏） */}
          {!manageMode && (
            <div className="mb-4 flex items-center gap-2.5">
              <span className="mr-1 text-[12px]" style={{ color: 'var(--color-text-5)' }}>
                快速新建
              </span>
              {QUICK_NEW.map(q => (
                <Link
                  key={q.type}
                  href={q.href}
                  className="flex h-7 items-center gap-1.5 rounded-full border bg-white px-4 text-[12px] font-medium transition-colors"
                  style={{
                    color: 'var(--color-text-3)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: TYPE_DOT_COLOR[q.type] }}
                  />
                  {q.label}
                </Link>
              ))}
            </div>
          )}

          {/* 智能体网格 */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {agents.map(a => (
              <AgentCard
                key={a.id}
                {...a}
                manageMode={manageMode}
                onDelete={() => setPendingDelete(a)}
              />
            ))}
            {!manageMode && (
              <Link
                href="/legacy/模板选择-v0.1.html"
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-transparent transition-colors hover:bg-[var(--color-primary-bg)] hover:[border-color:var(--color-primary)]"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-5)',
                  minHeight: 168,
                }}
              >
                <span className="text-[22px] leading-none">＋</span>
                <span className="text-[13px]">从模板创建</span>
              </Link>
            )}
          </div>
        </HomePhase>

        {/* ③ 评价 */}
        <HomePhase
          num="③"
          title="评价"
          sub="回看学生与 AI 的对话记录"
          actions={
            <Link
              href="/records"
              className="text-[13px] transition-colors hover:underline"
              style={{ color: 'var(--color-text-3)' }}
            >
              全部记录 →
            </Link>
          }
        >
          <div className="flex flex-col gap-2">
            <SessionRow
              avatar="水"
              type="discuss"
              title="水的三态变化讨论 · 三(2)班"
              stats={['96 条对话', '30 人参与', '平均 3 条/人']}
              time="昨天 14:30"
              href="/legacy/思辨记录详情-v0.1.html"
            />
            <SessionRow
              avatar="判"
              type="debate"
              title="AI 该有自己判断吗 · 六(1)班"
              stats={['31 条对话', '8 人参与', '3 轮完整辩论']}
              time="3 天前 09:15"
              href="/legacy/思辨记录详情-v0.1.html"
            />
          </div>
        </HomePhase>
      </main>

      <ConfirmModal
        open={!!pendingDelete}
        title="确认删除？"
        message={`删除后该智能体「${pendingDelete?.name ?? ''}」将无法找回。`}
        confirmText="确认删除"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

interface SessionRowProps {
  avatar: string;
  type: AgentType;
  title: string;
  stats: string[];
  time: string;
  href: string;
}

function SessionRow({ avatar, type, title, stats, time, href }: SessionRowProps) {
  const colors = {
    dialogue: { bg: 'var(--color-primary-bg)',    fg: 'var(--color-primary)' },
    debate:   { bg: 'var(--color-debate-bg)',     fg: 'var(--color-debate)' },
    discuss:  { bg: 'var(--color-discussion-bg)', fg: 'var(--color-discussion)' },
  }[type];

  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-xl border bg-white px-5 py-3.5 transition-colors hover:[border-color:var(--color-text-5)]"
      style={{ borderColor: 'var(--color-border)', color: 'inherit' }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
        style={{ background: colors.bg, color: colors.fg }}
      >
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1 text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>
          {title}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] tnum" style={{ color: 'var(--color-text-4)' }}>
          {stats.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              {i > 0 && (
                <span
                  className="h-[3px] w-[3px] rounded-full"
                  style={{ background: 'var(--color-border)' }}
                />
              )}
              <span>{s}</span>
            </span>
          ))}
        </div>
      </div>
      <span className="text-[12px] tnum shrink-0" style={{ color: 'var(--color-text-5)' }}>
        {time}
      </span>
    </Link>
  );
}
