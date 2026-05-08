'use client';

import { useRouter } from 'next/navigation';
import type { AppRecord } from '@/lib/types';
import { PREP_KIND_LABEL, PREP_KIND_TO_PATH } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  dialogue:   'AI 学问',
  debate:     'AI 辩论',
  discussion: 'AI 讨论',
};

const TYPE_TOKENS: Record<string, { bg: string; fg: string; deep: string }> = {
  dialogue: {
    bg:   'var(--color-type-dialogue-bg)',
    fg:   'var(--color-type-dialogue)',
    deep: 'var(--color-type-dialogue-deep)',
  },
  debate: {
    bg:   'var(--color-type-debate-bg)',
    fg:   'var(--color-type-debate)',
    deep: 'var(--color-type-debate-deep)',
  },
  discussion: {
    bg:   'var(--color-type-discussion-bg)',
    fg:   'var(--color-type-discussion)',
    deep: 'var(--color-type-discussion-deep)',
  },
  prep: {
    bg:   'var(--color-prep-bg)',
    fg:   'var(--color-prep)',
    deep: 'var(--color-prep)',
  },
};

interface Props {
  record: AppRecord;
  onPrimary?: (r: AppRecord) => void;
  onDelete?: (r: AppRecord) => void;
}

/**
 * 记录条目 · library catalog row
 * - 单栏长版列表：1px paper-edge 框 + paper-card 浮纸底
 * - 顶部 4px type-color 章式横条（与 AgentCard 同款语义）
 * - 不再用 rounded-full 圆头像，方形 stamp
 * - 操作按钮：恢复对话/打开 = paper-stamp filled，删除 = ghost type-debate
 */
export function RecordCard({ record: r, onPrimary, onDelete }: Props) {
  const router = useRouter();
  const tokens = TYPE_TOKENS[r.type] ?? TYPE_TOKENS.dialogue;
  const typeLabel =
    r.type === 'prep'
      ? `产出 · ${PREP_KIND_LABEL[r.kind]}`
      : TYPE_LABEL[r.type] ?? r.type;

  function handlePrimary(e: React.MouseEvent) {
    e.stopPropagation();
    if (onPrimary) return onPrimary(r);
    if (r.type === 'prep') {
      router.push(PREP_KIND_TO_PATH[r.kind]);
      return;
    }
    router.push(`/records/${encodeURIComponent(r.id)}`);
  }

  const primaryLabel =
    r.type === 'prep'        ? '打开' :
    r.type === 'dialogue'    ? '恢复对话' :
    r.type === 'debate'      ? '查看报告' :
    r.type === 'discussion'  ? '查看记录' :
    '打开';

  return (
    <article
      className="group relative flex cursor-pointer flex-col overflow-hidden border transition-all duration-200 hover:[box-shadow:var(--shadow-pop)]"
      style={{
        background: 'var(--color-paper-card)',
        borderColor: 'var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onClick={handlePrimary}
    >
      {/* 顶部 type 章式横条 */}
      <span
        aria-hidden
        className="block h-[3px] w-full"
        style={{ background: tokens.fg }}
      />

      <div
        className="grid items-center gap-5 px-6 py-5"
        style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}
      >
        {/* 头像 stamp */}
        <span
          aria-hidden
          className="font-numeric flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-[16px] font-bold"
          style={{
            background: tokens.bg,
            color: tokens.deep,
            borderRadius: 'var(--radius-xs)',
          }}
        >
          {r.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={r.avatarUrl}
              alt={r.title}
              width={512}
              height={512}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            r.avatar ?? r.title.charAt(0)
          )}
        </span>

        <div className="min-w-0">
          {/* 类型 + 时间 */}
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <span
              className="font-numeric text-[11px] uppercase tracking-[0.14em]"
              style={{ color: tokens.deep }}
            >
              {typeLabel}
            </span>
            <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>·</span>
            <span
              className="font-numeric tnum text-[12px]"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              {r.time ?? new Date(r.createdAt).toLocaleString('zh-CN')}
            </span>
          </div>

          {/* 标题 */}
          <h3
            className="font-display mb-1 truncate text-[18px] font-medium leading-tight"
            style={{ color: 'var(--color-ink-1)' }}
          >
            {r.title}
          </h3>

          {/* 摘要 */}
          <p
            className="truncate text-[13px] leading-[1.55]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {r.summary}
          </p>

          {r.agentName && (
            <p
              className="mt-1.5 text-[11px]"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              {r.type === 'prep' ? `来自智能体：${r.agentName}` : `使用智能体：${r.agentName}`}
            </p>
          )}
        </div>

        {/* 操作 */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handlePrimary}
            className="font-display flex h-9 items-center px-4 text-[13px] font-medium text-white transition-all"
            style={{
              background: 'var(--color-paper-stamp)',
              borderRadius: 'var(--radius-sm)',
              letterSpacing: '0.2px',
            }}
          >
            {primaryLabel}
          </button>
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(r); }}
              className="h-9 px-3.5 text-[13px] transition-colors hover:bg-[var(--color-type-debate-bg)]"
              style={{
                color: 'var(--color-type-debate-deep)',
                border: '1px solid var(--color-paper-edge)',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
              }}
            >
              删除
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
