'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { RecordCard } from '@/components/RecordCard';
import { FilterChips, type FilterValue } from '@/components/FilterChips';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { FALLBACK_RECORDS } from '@/lib/fallback-records';
import type { AppRecord } from '@/lib/types';

const VALID_FILTERS: FilterValue[] = ['all', 'dialogue', 'debate', 'discussion', 'prep'];

export default function RecordsPage() {
  // useSearchParams 需要 Suspense 边界（Next.js 静态生成阶段可能没 search params 上下文）
  return (
    <Suspense fallback={null}>
      <RecordsPageInner />
    </Suspense>
  );
}

function RecordsPageInner() {
  const toast = useToast();
  const sp = useSearchParams();
  const initialFilter = (() => {
    const f = sp.get('filter');
    return f && (VALID_FILTERS as string[]).includes(f) ? (f as FilterValue) : 'all';
  })();
  const [remote, setRemote] = useState<AppRecord[]>([]);
  // 硬编码 demo（FALLBACK_RECORDS）删不掉源码，KV 里存了一份"已隐藏 id"集合（records:hidden-fallback）
  // 真实 KV 记录走 DELETE 物理删除，不会进这个集合
  const [hiddenFallback, setHiddenFallback] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterValue>(initialFilter);
  const [pendingDelete, setPendingDelete] = useState<AppRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 拉远端记录 + 已隐藏 fallback id 列表
  useEffect(() => {
    let alive = true;
    fetch('/api/records')
      .then(r => r.json())
      .then((d: { records?: AppRecord[]; hiddenFallbackIds?: string[] }) => {
        if (!alive) return;
        setRemote(d.records ?? []);
        setHiddenFallback(new Set(d.hiddenFallbackIds ?? []));
      })
      .catch(() => { /* 静默：保留 fallback */ })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const all = useMemo(() => {
    const remoteIds = new Set(remote.map(r => r.id));
    const merged: AppRecord[] = [
      ...remote,
      ...FALLBACK_RECORDS.filter(f => !remoteIds.has(f.id) && !hiddenFallback.has(f.id)),
    ];
    return merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [remote, hiddenFallback]);

  const filtered = useMemo(() => {
    if (filter === 'all') return all;
    return all.filter(r => r.type === filter);
  }, [all, filter]);

  const resultHint =
    filter === 'all'
      ? `共 ${all.length} 条`
      : `${filtered.length} / ${all.length} 条`;

  function askDelete(r: AppRecord) {
    setPendingDelete(r);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const r = pendingDelete;
    setPendingDelete(null);

    const isRemote = remote.some(x => x.id === r.id);
    try {
      const res = await fetch(`/api/records/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        toast('删除失败：服务暂不可用');
        return;
      }
    } catch {
      toast('删除失败：网络错误');
      return;
    }

    // 乐观更新：真 KV 记录从 remote 摘掉；FALLBACK 加进 hiddenFallback
    if (isRemote) {
      setRemote(prev => prev.filter(x => x.id !== r.id));
    } else {
      setHiddenFallback(prev => {
        const n = new Set(prev);
        n.add(r.id);
        return n;
      });
    }
    toast(`已删除：${r.title}`);
  }

  return (
    <>
      <Topbar crumb="我的记录" />
      <main
        className="mx-auto w-full px-10 pt-8 pb-16"
        style={{ maxWidth: 'var(--container-list)' }}
      >
        {/* 章节版口 · stamp + display 标题 + 副标 */}
        <header
          className="mb-6 flex items-end gap-5 border-t pt-5"
          style={{ borderColor: 'var(--color-paper-rule)' }}
        >
          <span
            className="stamp h-10 w-10 shrink-0 text-[14px]"
            style={{ borderRadius: 'var(--radius-xs)' }}
            aria-hidden
          >
            REC
          </span>
          <div className="flex flex-1 items-baseline gap-4 min-w-0">
            <h1
              className="font-display text-[28px] font-medium leading-none tracking-[0.5px]"
              style={{ color: 'var(--color-ink-1)' }}
            >
              所有记录
            </h1>
            <p
              className="text-[14px] leading-snug truncate"
              style={{ color: 'var(--color-ink-3)' }}
            >
              回看学生与 AI 的全部对话与产出
            </p>
          </div>
          {!loaded && (
            <span
              className="font-numeric tnum text-[12px] shrink-0"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              拉取远端中…
            </span>
          )}
        </header>

        <FilterChips current={filter} onChange={setFilter} resultHint={resultHint} />

        {filtered.length === 0 ? (
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
              style={{
                borderRadius: 'var(--radius-xs)',
                background: 'var(--color-paper-edge)',
                color: 'var(--color-ink-mute)',
              }}
              aria-hidden
            >
              ø
            </span>
            <div
              className="font-display text-[18px] font-medium"
              style={{ color: 'var(--color-ink-2)' }}
            >
              当前筛选下没有记录
            </div>
            <div
              className="text-[13px]"
              style={{ color: 'var(--color-ink-3)' }}
            >
              换个类型试试 / 或者去备课页生成新内容
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(r => (
              <RecordCard key={r.id} record={r} onDelete={askDelete} />
            ))}
          </div>
        )}
      </main>

      <ConfirmModal
        open={!!pendingDelete}
        title="确认删除？"
        message="删除后该条记录将无法找回，且不会再出现在我的记录中。"
        confirmText="确认删除"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
