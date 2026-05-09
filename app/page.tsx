'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { ToolCard } from '@/components/ToolCard';
import { AgentCard } from '@/components/AgentCard';
import { AgentFilters } from '@/components/AgentFilters';
import { RecordCard } from '@/components/RecordCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { FALLBACK_RECORDS } from '@/lib/fallback-records';
import type { AppRecord } from '@/lib/types';
import { type AgentSeed } from '@/lib/agents-display';
import { useAgents } from '@/lib/use-agents';

// 记录 tab 现在是 1/3 的页面，给的额度比之前混排时多
const HOME_RECORDS_LIMIT = 8;

type HomeTab = 'prep' | 'use' | 'records' | 'outputs';

const TAB_DEFS: { id: HomeTab; num: string; label: string }[] = [
  { id: 'prep', num: '01', label: '备课' },
  { id: 'use', num: '02', label: '授课' },
  { id: 'records', num: '03', label: '记录' },
  { id: 'outputs', num: '04', label: '我的产出' },
];

/**
 * tab 模式下的瘦身 section 头：sub 副标 + meta + 右侧 actions
 * 不带 stamp/title —— 那两块已经由 HomeTabNav 承担
 */
function SectionActions({
  sub,
  meta,
  right,
}: {
  sub: string;
  meta?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-baseline gap-4 min-w-0">
      <p
        className="text-[14px] leading-snug truncate"
        style={{ color: 'var(--color-ink-3)' }}
      >
        {sub}
      </p>
      {meta && (
        <span
          className="font-numeric tnum text-[12px] shrink-0"
          style={{ color: 'var(--color-ink-mute)' }}
        >
          {meta}
        </span>
      )}
      {right && (
        <div className="ml-auto flex items-center gap-3 shrink-0">{right}</div>
      )}
    </div>
  );
}

function HomeTabNav({
  active,
  onChange,
}: {
  active: HomeTab;
  onChange: (t: HomeTab) => void;
}) {
  return (
    <nav
      className="mb-10 flex items-end gap-12 border-b"
      style={{ borderColor: 'var(--color-paper-rule)' }}
      aria-label="主分页"
    >
      {TAB_DEFS.map(t => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="relative pb-4 pt-1 transition-colors"
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="flex items-baseline gap-3.5">
              <span
                className="font-numeric text-[12px] tracking-[0.18em]"
                style={{
                  color: isActive
                    ? 'var(--color-paper-stamp)'
                    : 'var(--color-ink-mute)',
                }}
              >
                {t.num}
              </span>
              <span
                className="font-display text-[26px] font-medium leading-none tracking-[0.4px]"
                style={{
                  color: isActive ? 'var(--color-ink-1)' : 'var(--color-ink-3)',
                }}
              >
                {t.label}
              </span>
            </span>
            {isActive && (
              <span
                aria-hidden
                className="absolute bottom-[-1px] left-0 right-0 h-[2px]"
                style={{ background: 'var(--color-paper-stamp)' }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * 底部 mini tab dock —— 投影 / 大屏场景下顶部 tab 触不到，给同一组 tab 在底部
 * 再镜像一份。设计上：圆角 paper-card pill + active 走 stamp 黑底白字，触控热区 ≥ 44px。
 */
function BottomTabDock({
  active,
  onChange,
}: {
  active: HomeTab;
  onChange: (t: HomeTab) => void;
}) {
  return (
    <div
      className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2"
      role="navigation"
      aria-label="底部分页"
    >
      <div
        className="flex items-center gap-1 border px-2 py-2"
        style={{
          background: 'var(--color-paper-card)',
          borderColor: 'var(--color-paper-edge)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        {TAB_DEFS.map(t => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className="font-display px-5 py-2 text-[14px] font-medium transition-colors"
              style={
                isActive
                  ? {
                      background: 'var(--color-paper-stamp)',
                      color: 'var(--color-paper-base)',
                      borderRadius: 'var(--radius-sm)',
                      letterSpacing: '0.3px',
                      minHeight: 44,
                    }
                  : {
                      color: 'var(--color-ink-2)',
                      borderRadius: 'var(--radius-sm)',
                      minHeight: 44,
                    }
              }
              aria-current={isActive ? 'page' : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 右下 floating primary action —— 不同 tab 显示对应主操作。
 * 大屏下手指落点距 [bottom-right] 比 [top-right "AI 创建"] 顺得多。
 */
function FabPrimary({
  tab,
  onScrollTop,
}: {
  tab: HomeTab;
  onScrollTop: () => void;
}) {
  if (tab === 'use') {
    return (
      <Link
        href="/create"
        className="fixed bottom-6 right-6 z-30 flex h-14 items-center gap-2 px-5 font-display text-[14px] font-medium text-white transition-all hover:translate-y-[-1px]"
        style={{
          background: 'var(--color-paper-stamp)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-pop)',
          letterSpacing: '0.3px',
        }}
        title="AI 创建：描述一句，自动判断类型并生成草稿"
      >
        <span aria-hidden style={{ opacity: 0.7 }}>＋</span>
        <span>AI 创建</span>
      </Link>
    );
  }
  if (tab === 'records' || tab === 'outputs') {
    return (
      <button
        type="button"
        onClick={onScrollTop}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center border text-[18px] transition-all hover:translate-y-[-1px]"
        style={{
          background: 'var(--color-paper-card)',
          borderColor: 'var(--color-paper-edge)',
          color: 'var(--color-ink-1)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-pop)',
        }}
        aria-label="回到顶部"
        title="回到顶部"
      >
        ↑
      </button>
    );
  }
  return null;
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
  {
    icon: '🧪',
    name: '项目化学习设计',
    desc: '按驱动性问题 + 阶段拆分 + 评价量规生成跨课时 PBL 方案',
    tags: ['PBL', '跨学科'],
    href: '/prep/project',
  },
];

export default function Home() {
  const toast = useToast();
  // 共用 hook：合并 KV 已保存 + INITIAL_AGENTS 种子 + localStorage/KV 双隐藏过滤；
  // alive guard 在 hook 内处理。manage 模式删卡的本地 state 同步走 hook 暴露的两个 mutator。
  const { agents, savedAgents, removeSavedLocally, hideSeedLocally } = useAgents();
  const [manageMode, setManageMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AgentSeed | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 授课 tab 内联筛选 — 不持久化到 URL，scope 在当前 tab session
  const [agentSubject, setAgentSubject] = useState<string>('all');
  const [agentGrade, setAgentGrade] = useState<string>('all');
  const [agentSort, setAgentSort] = useState<string>('lastUsed');
  const [agentType, setAgentType] = useState<string>('all');

  const filteredAgents = useMemo(() => {
    const filtered = agents.filter(
      a =>
        (agentSubject === 'all' || a.subject === agentSubject) &&
        (agentGrade === 'all' || a.grade === agentGrade) &&
        (agentType === 'all' || a.type === agentType),
    );
    const key: 'createdAt' | 'lastUsedAt' =
      agentSort === 'createdAt' ? 'createdAt' : 'lastUsedAt';
    return [...filtered].sort((a, b) => (a[key] < b[key] ? 1 : -1));
  }, [agents, agentSubject, agentGrade, agentType, agentSort]);

  // 主分页：备课 / 授课 / 记录。url hash 同步，刷新 / 后退保留状态。
  const [tab, setTab] = useState<HomeTab>('prep');
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.slice(1);
      if (h === 'prep' || h === 'use' || h === 'records' || h === 'outputs') {
        setTab(h);
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
  function selectTab(next: HomeTab) {
    setTab(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${next}`);
    }
    // 切走时退出管理模式，避免在隐藏 tab 里残留 dirty state
    if (next !== 'use' && manageMode) setManageMode(false);
  }

  // 首页"记录" + "我的产出"两个 tab 共用一次拉取：
  //   recents     = 学生×AI 对话类（dialogue/debate/discussion）
  //   prepRecents = 备课产出类（type === 'prep'）
  // FALLBACK 兜底避免首屏闪空；被在 /records 删掉的 FALLBACK demo 同步隐藏。
  const [recents, setRecents] = useState<AppRecord[]>(
    FALLBACK_RECORDS.filter(r => r.type !== 'prep').slice(0, HOME_RECORDS_LIMIT),
  );
  const [prepRecents, setPrepRecents] = useState<AppRecord[]>(
    FALLBACK_RECORDS.filter(r => r.type === 'prep').slice(0, HOME_RECORDS_LIMIT),
  );
  useEffect(() => {
    let alive = true;
    fetch('/api/records')
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
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
        setRecents(merged.filter(r => r.type !== 'prep').slice(0, HOME_RECORDS_LIMIT));
        setPrepRecents(merged.filter(r => r.type === 'prep').slice(0, HOME_RECORDS_LIMIT));
      })
      .catch(() => { /* 留 FALLBACK 兜底 */ });
    return () => { alive = false; };
  }, []);

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
        removeSavedLocally(target.id);
      } else {
        // seed 卡片：源码硬编码，服务端删不掉；hook 内部走 localStorage 持久化隐藏
        hideSeedLocally(target.id);
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
        className="mx-auto w-full px-10 pt-10 pb-40"
        // 首页四宫格 + 长版 record 列表 — 比 detail 页更宽。
        // viewport 自适应：大屏给到 1480，窄屏自动收回不顶边
        style={{ maxWidth: 'min(1480px, calc(100vw - 80px))' }}
      >
        <HomeTabNav active={tab} onChange={selectTab} />

        {/* 备课 tab — 平台 AI 工具卡片格 */}
        {tab === 'prep' && (
          <section>
            <SectionActions
              sub="平台 AI 工具，把课备扎实"
              right={
                <button
                  onClick={() => toast('暂未开放')}
                  className="text-[13px] transition-colors hover:underline"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  查看全部 →
                </button>
              }
            />
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {TOOLS.map(t => (
                <ToolCard key={t.name} {...t} />
              ))}
            </div>
          </section>
        )}

        {/* 授课 tab */}
        {tab === 'use' && (
          <section>
            <SectionActions
              sub={manageMode ? '管理模式 · 可编辑或删除你的智能体' : '我配置好的，随时启动'}
              meta={
                !manageMode &&
                `共 ${agents.length} 个${savedAgents.length > 0 ? `（${savedAgents.length} 个已保存）` : ''}`
              }
              right={
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
            />
            {!manageMode && (
              <AgentFilters
                subject={agentSubject}
                grade={agentGrade}
                sort={agentSort}
                type={agentType}
                onSubjectChange={setAgentSubject}
                onGradeChange={setAgentGrade}
                onSortChange={setAgentSort}
                onTypeChange={setAgentType}
                resultHint={
                  filteredAgents.length === agents.length
                    ? `共 ${agents.length} 个`
                    : `${filteredAgents.length} / ${agents.length} 个`
                }
              />
            )}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {filteredAgents.map(a => (
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
          </section>
        )}

        {/* 记录 tab — 学生 × AI 的对话记录（不含 prep 产出；那一类走顶栏"我的产出"） */}
        {tab === 'records' && (
          <section>
            <SectionActions
              sub="回看学生与 AI 的对话记录"
              right={
                <Link
                  href="/records"
                  className="text-[13px] transition-colors hover:underline"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  全部记录 →
                </Link>
              }
            />
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
          </section>
        )}

        {/* 我的产出 tab — 仅 type === 'prep' 的备课产出 */}
        {tab === 'outputs' && (
          <section>
            <SectionActions
              sub="备课工具的稿件产出（教案 / 大纲 / 习题 / 活动 / PBL）"
              right={
                <Link
                  href="/records?filter=prep"
                  className="text-[13px] transition-colors hover:underline"
                  style={{ color: 'var(--color-text-3)' }}
                >
                  全部产出 →
                </Link>
              }
            />
            {prepRecents.length === 0 ? (
              <div
                className="rounded-xl border bg-white p-6 text-center text-[13px]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-4)' }}
              >
                还没有产出，去备课 tab 生成一份
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {prepRecents.map(r => (
                  <RecordCard key={r.id} record={r} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* 大屏 / 投影场景：底部镜像 tab + 右下主操作 — 不用伸手够顶部 */}
      <BottomTabDock active={tab} onChange={selectTab} />
      <FabPrimary
        tab={tab}
        onScrollTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

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

