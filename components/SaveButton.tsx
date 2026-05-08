'use client';

interface Props {
  saved: boolean;
  saving?: boolean;
  onSave: () => void;
}

/**
 * 保存按钮组合 · 状态指示 + paper-stamp filled action
 */
export function SaveButton({ saved, saving, onSave }: Props) {
  const statusColor =
    saving ? 'var(--color-ink-mute)' :
    saved ? 'var(--color-launch-deep)' :
    'var(--color-ink-mute)';

  const statusText =
    saving ? '保存中…' :
    saved ? '已保存' :
    '未保存';

  return (
    <>
      <span
        className="font-numeric text-[11px] uppercase tracking-[0.14em]"
        style={{ color: statusColor }}
      >
        {saved && !saving && (
          <span aria-hidden style={{ marginRight: 6 }}>✓</span>
        )}
        {statusText}
      </span>
      <button
        onClick={onSave}
        disabled={saving}
        className="font-display flex h-10 items-center gap-2 px-5 text-[14px] font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: 'var(--color-paper-stamp)',
          borderRadius: 'var(--radius-sm)',
          letterSpacing: '0.3px',
        }}
      >
        <span aria-hidden style={{ color: 'var(--color-paper-base)', opacity: 0.55 }}>
          ▸
        </span>
        <span>保存到记录</span>
      </button>
    </>
  );
}
