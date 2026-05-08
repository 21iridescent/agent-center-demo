'use client';

import { useEffect, useMemo, useState } from 'react';
import { Topbar } from '@/components/Topbar';
import { RecordCard } from '@/components/RecordCard';
import { FilterChips, type FilterValue } from '@/components/FilterChips';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { FALLBACK_RECORDS } from '@/lib/fallback-records';
import type { AppRecord } from '@/lib/types';

export default function RecordsPage() {
  const toast = useToast();
  const [remote, setRemote] = useState<AppRecord[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterValue>('all');
  const [pendingDelete, setPendingDelete] = useState<AppRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 拉远端记录
  useEffect(() => {
    let alive = true;
    fetch('/api/records')
      .then(r => r.json())
      .then((d: { records?: AppRecord[] }) => {
        if (!alive) return;
        setRemote(d.records ?? []);
      })
      .catch(() => { /* 静默：保留 fallback */ })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  // 远端 + fallback；远端 id 覆盖 fallback；按 createdAt 倒序
  const all = useMemo(() => {
    const remoteIds = new Set(remote.map(r => r.id));
    const merged: AppRecord[] = [
      ...remote,
      ...FALLBACK_RECORDS.filter(f => !remoteIds.has(f.id)),
    ];
    return merged
      .filter(r => !hidden.has(r.id))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [remote, hidden]);

  const filtered = useMemo(() => {
    if (filter === 'all') return all;
    return all.filter(r => r.type === filter);
  }, [all, filter]);

  const resultHint =
    filter === 'all'
      ? `共 ${all.length} 条记录`
      : `筛选结果 ${filtered.length} / ${all.length}`;

  function askDelete(r: AppRecord) {
    setPendingDelete(r);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const r = pendingDelete;
    setPendingDelete(null);

    const isRemote = remote.some(x => x.id === r.id);
    if (isRemote) {
      try {
        const res = await fetch(`/api/records/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
        if (!res.ok) {
          toast('删除失败：服务暂不可用');
          return;
        }
        setRemote(prev => prev.filter(x => x.id !== r.id));
      } catch {
        toast('删除失败：网络错误');
        return;
      }
    } else {
      // fallback 记录只是前端隐藏
      setHidden(prev => {
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
      <main className="mx-auto w-full px-8 pt-6 pb-16" style={{ maxWidth: 'var(--container-list)' }}>
        <h2 className="mb-3 flex items-center gap-2.5 text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>
          <span className="h-3.5 w-[3px]" style={{ background: 'var(--color-primary)' }} />
          所有记录
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-normal"
            style={{ background: 'var(--color-border-soft)', color: 'var(--color-text-5)' }}
          >
            按类型筛选
          </span>
        </h2>

        <FilterChips current={filter} onChange={setFilter} resultHint={resultHint} />

        {filtered.length === 0 ? (
          <div
            className="mt-4 rounded-xl border border-dashed px-5 py-20 text-center text-[14px]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-5)' }}
          >
            <div className="mb-3 text-[32px]" style={{ color: 'var(--color-text-7)' }}>○</div>
            <div>当前筛选下没有记录</div>
            <div className="mt-2 text-[12px]" style={{ color: 'var(--color-text-6)' }}>
              换个类型试试
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map(r => (
              <RecordCard key={r.id} record={r} onDelete={askDelete} />
            ))}
          </div>
        )}

        {!loaded && (
          <div
            className="mt-4 rounded-md border bg-white px-4 py-3 text-[12px]"
            style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-5)' }}
          >
            正在拉取远端记录…（如未配置 KV，仅显示 12 条预置 fallback）
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
