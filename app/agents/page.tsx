'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar';
import { AgentCard } from '@/components/AgentCard';
import { AgentFilters } from '@/components/AgentFilters';
import { useAgents } from '@/lib/use-agents';
import type { AgentSeed } from '@/lib/agents-display';

const VALID_SUBJECTS = ['all', '科学', '人工智能'] as const;
const VALID_GRADES = ['all', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级'] as const;
const VALID_SORTS = ['lastUsed', 'createdAt'] as const;

export default function AgentsPage() {
  // useSearchParams 需要 Suspense 边界（Next.js 静态生成阶段可能没 search params 上下文）
  return (
    <Suspense fallback={null}>
      <AgentsPageInner />
    </Suspense>
  );
}

function AgentsPageInner() {
  const sp = useSearchParams();
  const subject = readParam(sp.get('subject'), VALID_SUBJECTS, 'all');
  const grade   = readParam(sp.get('grade'),   VALID_GRADES,   'all');
  const sort    = readParam(sp.get('sort'),    VALID_SORTS,    'lastUsed');

  // 共用 hook：合并 KV 已保存 + INITIAL_AGENTS 种子 + localStorage/KV 双隐藏过滤
  const { agents: all, loaded } = useAgents();

  const filteredSorted = useMemo(() => {
    const filtered = all.filter(
      (a: AgentSeed) =>
        (subject === 'all' || a.subject === subject) &&
        (grade   === 'all' || a.grade   === grade),
    );
    // ISO 8601 字典序==时间序，可直接字符串比较
    const key: 'createdAt' | 'lastUsedAt' = sort === 'createdAt' ? 'createdAt' : 'lastUsedAt';
    return [...filtered].sort((a, b) => (a[key] < b[key] ? 1 : -1));
  }, [all, subject, grade, sort]);

  /**
   * 写 URL 用 history.replaceState（Next 16 文档推荐的 client-side filter 模式）
   * —— 切 chip 不要每次 push 一格回退栈；默认值（'all' / 'lastUsed'）从 URL 删掉，
   * 让分享链接保持干净。
   */
  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    const isDefault =
      (key === 'subject' && value === 'all') ||
      (key === 'grade'   && value === 'all') ||
      (key === 'sort'    && value === 'lastUsed');
    if (isDefault) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `/agents?${qs}` : '/agents');
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-paper-base)' }}>
      <Topbar />
      <div
        className="mx-auto w-full px-10 pt-10 pb-24"
        style={{ maxWidth: 'min(1480px, calc(100vw - 80px))' }}
      >
        <header
          className="mb-6 flex items-end gap-5 border-t pt-5"
          style={{ borderColor: 'var(--color-paper-rule)' }}
        >
          <span
            className="stamp h-10 w-10 shrink-0 text-[14px]"
            style={{ borderRadius: 'var(--radius-xs)' }}
            aria-hidden
          >
            ALL
          </span>
          <div className="flex flex-1 items-baseline gap-4 min-w-0">
            <h1
              className="font-display text-[28px] font-medium leading-none tracking-[0.5px]"
              style={{ color: 'var(--color-ink-1)' }}
            >
              全部智能体
            </h1>
            <p
              className="text-[14px] leading-snug truncate"
              style={{ color: 'var(--color-ink-3)' }}
            >
              按学科 / 年级 / 时间检索归档
            </p>
            {!loaded && (
              <span
                className="font-numeric tnum text-[12px] shrink-0"
                style={{ color: 'var(--color-ink-mute)' }}
              >
                拉取远端中…
              </span>
            )}
          </div>
          <Link
            href="/create"
            className="font-display group flex h-8 shrink-0 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-all hover:translate-x-[1px]"
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
        </header>

        <AgentFilters
          subject={subject}
          grade={grade}
          sort={sort}
          resultHint={`共 ${filteredSorted.length} 个`}
          onSubjectChange={v => setParam('subject', v)}
          onGradeChange={v => setParam('grade', v)}
          onSortChange={v => setParam('sort', v)}
        />

        {filteredSorted.length > 0 ? (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            {filteredSorted.map(a => (
              <AgentCard
                key={a.id}
                type={a.type}
                avatar={a.avatar}
                avatarUrl={a.avatarUrl}
                bgUrl={a.bgUrl}
                name={a.name}
                subject={a.subject}
                grade={a.grade}
                lastUsed={a.lastUsed}
                launchHref={a.launchHref}
                editHref={`/edit/${a.id}`}
                manageMode={false}
                onDelete={() => { /* /agents 是只读检索页，不开 manage */ }}
              />
            ))}
            {/* 网格末尾的"新建"占位卡 —— 与首页 ② 同款 dashed 卡 */}
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
          </div>
        ) : (
          loaded && (
            <div
              className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center"
              style={{
                background: 'var(--color-paper-soft)',
                border: '1px solid var(--color-paper-edge)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span
                className="stamp h-10 w-10 text-[12px]"
                style={{ borderRadius: 'var(--radius-xs)' }}
                aria-hidden
              >
                ø
              </span>
              <div
                className="font-display text-[18px] font-medium"
                style={{ color: 'var(--color-ink-1)' }}
              >
                当前筛选下没有智能体
              </div>
              <div className="text-[13px]" style={{ color: 'var(--color-ink-3)' }}>
                换个学科 / 年级试试，或者去{' '}
                <Link
                  href="/create"
                  className="underline decoration-1 underline-offset-[3px]"
                  style={{ color: 'var(--color-type-dialogue-deep)' }}
                >
                  AI 创建
                </Link>{' '}
                做一个
              </div>
            </div>
          )
        )}
      </div>
    </main>
  );
}

function readParam<T extends readonly string[]>(
  raw: string | null,
  valid: T,
  fallback: T[number],
): T[number] {
  if (raw && (valid as readonly string[]).includes(raw)) return raw as T[number];
  return fallback;
}
