'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { HomePhase } from '@/components/HomePhase';
import { ToolCard } from '@/components/ToolCard';
import { AgentCard, type AgentType } from '@/components/AgentCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import type { SavedAgent } from '@/lib/agent-storage';

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

// 注：seed-* id 与 lib/agent-storage.ts 的 SEED_AGENTS 配对
// 学问/辩论 2 张接真使用页（点"启动"跑真 DeepSeek）；讨论 2 张仍 legacy（无真使用页）
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
    editHref: '/create',
  },
  {
    id: 'seed-machine-vision',
    type: 'dialogue',
    avatar: '像',
    name: '机器视觉博士',
    subject: '人工智能',
    grade: '五年级',
    lastUsed: '3 天前',
    launchHref: '/use/xuewen/seed-machine-vision',
    editHref: '/create',
  },
  {
    id: 'seed-ai-judgement',
    type: 'debate',
    avatar: '判',
    name: 'AI 该有自己判断吗',
    subject: '人工智能',
    grade: '六年级',
    lastUsed: '上周',
    launchHref: '/use/debate/seed-ai-judgement',
    editHref: '/create',
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
    editHref: '/create',
  },
];

const TYPE_DOT_COLOR: Record<AgentType, string> = {
  dialogue: 'var(--color-primary)',
  debate:   'var(--color-debate)',
  discuss:  'var(--color-discussion)',
};

// SavedAgent.kind → UI AgentType
const KIND_TO_TYPE: Record<string, AgentType> = {
  xuewen: 'dialogue',
  debate: 'debate',
  discussion: 'discuss',
};
const TYPE_TO_LAUNCH: Record<AgentType, string> = {
  dialogue: '/legacy/AI学问使用-v0.1.html',
  debate:   '/legacy/AI思辨使用-辩论-v0.1.html',
  discuss:  '/legacy/AI思辨使用-讨论-v0.1.html',
};

// 模板式快建：已知 kind，直达 /create/[kind] 50/50 模板页
const KIND_TO_CREATE: Record<string, string> = {
  xuewen: '/create/xuewen',
  debate: '/create/debate',
  discussion: '/create/discussion',
};

const QUICK_NEW = [
  { type: 'dialogue' as const, label: '学问', href: '/create/xuewen' },
  { type: 'debate'   as const, label: '辩论', href: '/create/debate' },
  { type: 'discuss'  as const, label: '讨论', href: '/create/discussion' },
];

/**
 * SavedAgent → 首页 launch URL
 * - 学问/辩论：跳真使用页 /use/{kind}/{id}
 * - 讨论：本期使用页未实现，仍指 legacy（不破坏卡片）
 * 注：INITIAL_AGENTS 4 张 seed 演示数据继续指 legacy，本函数只处理保存到 KV 的智能体
 */
const SAVED_LAUNCH: Record<string, (id: string) => string> = {
  xuewen: id => `/use/xuewen/${id}`,
  debate: id => `/use/debate/${id}`,
  discussion: () => '/legacy/AI思辨使用-讨论-v0.1.html',
};

function savedToSeed(a: SavedAgent): AgentSeed {
  const cfg = a.config as Record<string, string | undefined>;
  const type = KIND_TO_TYPE[a.kind] ?? 'dialogue';
  const name = cfg.name ?? '未命名';
  const launchFn = SAVED_LAUNCH[a.kind] ?? (() => '/');
  return {
    id: a.id,
    type,
    avatar: name.charAt(0),
    name,
    subject: cfg.subject ?? '科学',
    grade: cfg.grade ?? '一年级',
    lastUsed: '刚刚',
    launchHref: launchFn(a.id),
    editHref: '/create',
  };
}

// localStorage key：跨刷新持久化"已隐藏的 seed id"
// seed 智能体（demo 演示卡）是源码硬编码，无法真删服务端；前端用 localStorage 记一份隐藏列表，跨刷新一致。
const HIDDEN_SEEDS_KEY = 'home:hidden-seeds';

function loadHiddenSeeds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(HIDDEN_SEEDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveHiddenSeeds(s: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HIDDEN_SEEDS_KEY, JSON.stringify([...s]));
  } catch {
    /* localStorage 不可用就接受会话内一致即可 */
  }
}

export default function Home() {
  const toast = useToast();
  const [savedAgents, setSavedAgents] = useState<AgentSeed[]>([]);
  const [hiddenSeeds, setHiddenSeeds] = useState<Set<string>>(new Set());
  const [manageMode, setManageMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AgentSeed | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 客户端 hydrate 后从 localStorage 读已隐藏 seed 列表（SSR 时 window 不可用）
  useEffect(() => {
    setHiddenSeeds(loadHiddenSeeds());
  }, []);

  // 拉真实保存的智能体，拼到 seed 之前
  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.agents)) {
          setSavedAgents(d.agents.map(savedToSeed));
        }
      })
      .catch(() => {});
  }, []);

  const seedAgents = useMemo(
    () => INITIAL_AGENTS.filter(a => !hiddenSeeds.has(a.id)),
    [hiddenSeeds],
  );
  const agents = [...savedAgents, ...seedAgents];

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    const target = pendingDelete;
    const isSaved = savedAgents.some(a => a.id === target.id);

    setDeleting(true);
    try {
      if (isSaved) {
        // 真删：调 DELETE API，让 KV/内存兜底真清掉，刷新后不会再回来
        const res = await fetch(`/api/agents/${encodeURIComponent(target.id)}`, {
          method: 'DELETE',
        });
        if (!res.ok && res.status !== 204) {
          toast('删除失败：服务暂不可用');
          return;
        }
        setSavedAgents(prev => prev.filter(a => a.id !== target.id));
      } else {
        // seed 卡片：源码硬编码，服务端删不掉；前端 localStorage 持久化隐藏
        setHiddenSeeds(prev => {
          const next = new Set(prev);
          next.add(target.id);
          saveHiddenSeeds(next);
          return next;
        });
      }
      toast(`已删除：${target.name}`);
      setPendingDelete(null);
    } catch {
      toast('删除失败：网络错误');
    } finally {
      setDeleting(false);
    }
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
          meta={!manageMode && `共 ${agents.length} 个${savedAgents.length > 0 ? `（${savedAgents.length} 个已保存）` : ''}`}
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
                <button
                  onClick={() => toast('暂未开放')}
                  className="text-[13px] transition-colors hover:underline"
                  style={{ color: 'var(--color-ink-3)' }}
                >
                  查看全部 →
                </button>
                <Link
                  href="/create"
                  className="text-[13px] transition-colors hover:underline"
                  style={{ color: 'var(--color-type-dialogue-deep)' }}
                >
                  ＋ 新建
                </Link>
                <button
                  onClick={() => setManageMode(true)}
                  className="h-7 rounded-full border bg-white px-4 text-[12px] transition-colors hover:[border-color:var(--color-type-dialogue)] hover:[color:var(--color-type-dialogue)]"
                  style={{
                    color: 'var(--color-ink-3)',
                    borderColor: 'var(--color-paper-edge)',
                  }}
                >
                  管理
                </button>
              </>
            )
          }
        >
          {!manageMode && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Link
                href="/create"
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-5 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: 'var(--color-primary)' }}
              >
                <span className="text-[15px] leading-none">＋</span>
                AI 创建
              </Link>
              <span className="text-[12px]" style={{ color: 'var(--color-text-5)' }}>
                或选模板
              </span>
              {QUICK_NEW.map(q => (
                <Link
                  key={q.type}
                  href={q.href}
                  className="flex h-7 items-center gap-1.5 rounded-full border bg-white px-4 text-[12px] font-medium transition-colors hover:[border-color:var(--color-primary)]"
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
                href="/create"
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-transparent transition-colors hover:bg-[var(--color-primary-bg)] hover:[border-color:var(--color-primary)]"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-5)',
                  minHeight: 168,
                }}
              >
                <span className="text-[22px] leading-none">＋</span>
                <span className="text-[13px]">AI 对话新建</span>
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
        confirmText={deleting ? '删除中…' : '确认删除'}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
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
