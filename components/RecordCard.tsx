'use client';

import { useRouter } from 'next/navigation';
import type { AppRecord } from '@/lib/types';
import { PREP_KIND_LABEL, PREP_KIND_TO_PATH } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  dialogue: 'AI 学问',
  debate: 'AI 辩论',
  discussion: 'AI 讨论',
};

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  dialogue:   { bg: 'var(--color-primary-bg)',    fg: 'var(--color-primary)' },
  debate:     { bg: 'var(--color-debate-bg)',     fg: 'var(--color-debate)' },
  discussion: { bg: 'var(--color-discussion-bg)', fg: 'var(--color-discussion)' },
  prep:       { bg: 'var(--color-prep-bg)',       fg: 'var(--color-prep)' },
};

interface Props {
  record: AppRecord;
  onPrimary?: (r: AppRecord) => void;
  onDelete?: (r: AppRecord) => void;
}

export function RecordCard({ record: r, onPrimary, onDelete }: Props) {
  const router = useRouter();
  const colors = TYPE_COLORS[r.type] ?? TYPE_COLORS.dialogue;
  const typeLabel =
    r.type === 'prep'
      ? `产出 · ${PREP_KIND_LABEL[r.kind]}`
      : TYPE_LABEL[r.type] ?? r.type;

  function handlePrimary(e: React.MouseEvent) {
    e.stopPropagation();
    if (onPrimary) return onPrimary(r);
    if (r.type === 'prep') {
      router.push(PREP_KIND_TO_PATH[r.kind]);
    } else {
      // 对话/辩论/讨论 → 导到对应 legacy 静态页（demo 兜底）
      // 各自去对应 use page；这里 demo 用 toast 占位
      alert(`打开：${r.title}（详情页未实现）`);
    }
  }

  return (
    <article
      className="grid cursor-pointer items-center gap-4 rounded-xl border bg-white px-5 py-4 transition-all"
      style={{
        gridTemplateColumns: '50px 1fr auto',
        borderColor: 'var(--color-border)',
      }}
      onClick={handlePrimary}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full text-[16px] font-semibold"
        style={{ background: colors.bg, color: colors.fg }}
      >
        {r.avatar ?? r.title.charAt(0)}
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-medium"
            style={{ background: colors.bg, color: colors.fg }}
          >
            {typeLabel}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--color-text-5)' }}>
            {r.time ?? new Date(r.createdAt).toLocaleString('zh-CN')}
          </span>
        </div>
        <div
          className="mb-1 truncate text-[15px] font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          {r.title}
        </div>
        <div
          className="truncate text-[12px] leading-[1.5]"
          style={{ color: 'var(--color-text-3)' }}
        >
          {r.summary}
        </div>
        {r.agentName && (
          <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-5)' }}>
            {r.type === 'prep' ? `来自智能体：${r.agentName}` : `使用智能体：${r.agentName}`}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          onClick={handlePrimary}
          className="h-8 rounded-md px-3.5 text-[12px] text-white transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          {r.type === 'prep' ? '打开' : r.type === 'dialogue' ? '恢复对话' : '查看报告'}
        </button>
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(r); }}
            className="h-8 rounded-md border bg-white px-3.5 text-[12px] transition-colors hover:bg-[var(--color-debate-bg)]"
            style={{
              borderColor: 'var(--color-debate-soft)',
              color: 'var(--color-debate)',
            }}
          >
            删除
          </button>
        )}
      </div>
    </article>
  );
}
