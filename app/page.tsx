'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { HomePhase } from '@/components/HomePhase';
import { ToolCard } from '@/components/ToolCard';
import { AgentCard } from '@/components/AgentCard';
import { RecordCard } from '@/components/RecordCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { FALLBACK_RECORDS } from '@/lib/fallback-records';
import type { AppRecord } from '@/lib/types';
import {
  INITIAL_AGENTS,
  KIND_TO_TYPE,
  savedToSeed,
  type AgentSeed,
} from '@/lib/agents-display';

const HOME_RECORDS_LIMIT = 3;

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
  {
    icon: '🧪',
    name: '项目化学习设计',
    desc: '按驱动性问题 + 阶段拆分 + 评价量规生成跨课时 PBL 方案',
    tags: ['PBL', '跨学科'],
    href: '/prep/project',
  },
];

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
  // 服务端持久化的隐藏 seed id（KV 'agents:hidden-seeds'），
  // 用于编辑 seed 后 copy-on-write 的隐藏 —— 跨设备一致
  const [hiddenSeedIds, setHiddenSeedIds] = useState<Set<string>>(new Set());
  const [manageMode, setManageMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AgentSeed | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 客户端 hydrate 后从 localStorage 读已隐藏 seed 列表（SSR 时 window 不可用）
  useEffect(() => {
    setHiddenSeeds(loadHiddenSeeds());
  }, []);

  // 拉真实保存的智能体 + 服务端隐藏 seed 集合
  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.agents)) {
          setSavedAgents(d.agents.map(savedToSeed));
        }
        if (Array.isArray(d.hiddenSeedIds)) {
          setHiddenSeedIds(new Set(d.hiddenSeedIds));
        }
      })
      .catch(() => {});
  }, []);

  // 首页 ③ 智能体使用：只展示学生×AI 对话类记录（dialogue/debate/discussion）。
  // prep 类（备课产出）走顶栏"我的产出"入口（/records?filter=prep），首页不再混排。
  // FALLBACK 兜底避免首屏闪空；被在 /records 删掉的 FALLBACK demo 同步隐藏。
  const [recents, setRecents] = useState<AppRecord[]>(
    FALLBACK_RECORDS.filter(r => r.type !== 'prep').slice(0, HOME_RECORDS_LIMIT),
  );
  useEffect(() => {
    fetch('/api/records')
      .then(r => r.json())
      .then(d => {
        const remote: AppRecord[] = Array.isArray(d.records) ? d.records : [];
        const hiddenFallback: Set<string> = new Set(
          Array.isArray(d.hiddenFallbackIds) ? d.hiddenFallbackIds : [],
        );
        const remoteIds = new Set(remote.map(r => r.id));
        const merged = [
          ...remote,
          ...FALLBACK_RECORDS.filter(
            r => !remoteIds.has(r.id) && !hiddenFallback.has(r.id),
          ),
        ];
        const useOnly = merged.filter(r => r.type !== 'prep');
        setRecents(useOnly.slice(0, HOME_RECORDS_LIMIT));
      })
      .catch(() => { /* 留 FALLBACK 兜底 */ });
  }, []);

  // 隐藏来源有两路：localStorage 兜底（旧的"删 seed"流）+ KV agents:hidden-seeds（新的"编辑 seed copy-on-write"流）
  const seedAgents = useMemo(
    () => INITIAL_AGENTS.filter(a => !hiddenSeeds.has(a.id) && !hiddenSeedIds.has(a.id)),
    [hiddenSeeds, hiddenSeedIds],
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
      <main
        className="mx-auto w-full px-10 pt-10 pb-24"
        // 首页四宫格 + 长版 record 列表 — 比 detail 页更宽。
        // viewport 自适应：大屏给到 1480，窄屏自动收回不顶边
        style={{ maxWidth: 'min(1480px, calc(100vw - 80px))' }}
      >
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
                <Link
                  href="/agents"
                  className="text-[13px] transition-colors hover:underline"
                  style={{ color: 'var(--color-ink-3)' }}
                >
                  查看全部 →
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
                <Link
                  href="/create"
                  className="font-display group flex h-8 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-all hover:translate-x-[1px]"
                  style={{
                    background: 'var(--color-paper-stamp)',
                    borderRadius: 'var(--radius-sm)',
                    letterSpacing: '0.3px',
                  }}
                  title="AI 创建：描述一句，自动判断类型并生成草稿"
                >
                  <span
                    aria-hidden
                    className="text-[10px]"
                    style={{ color: 'var(--color-paper-base)', opacity: 0.55 }}
                  >
                    NEW
                  </span>
                  <span aria-hidden style={{ opacity: 0.7 }}>▸</span>
                  AI 创建
                </Link>
              </>
            )
          }
        >

          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {agents.map(a => (
              <AgentCard
                key={a.id}
                {...a}
                editHref={`/edit/${a.id}`}
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

        {/* ③ 智能体使用 — 学生 × AI 的对话记录（不含 prep 产出，那一类走顶栏"我的产出"） */}
        <HomePhase
          num="③"
          title="智能体使用"
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
          {recents.length === 0 ? (
            <div
              className="rounded-xl border bg-white p-6 text-center text-[13px]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-4)' }}
            >
              暂无记录
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recents.map(r => (
                <RecordCard key={r.id} record={r} />
              ))}
            </div>
          )}
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

