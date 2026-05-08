'use client';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 'destructive' = 红 confirm（默认），'primary' = 蓝 confirm */
  variant?: 'destructive' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirm 模态 · 卡式贴纸
 * - 浮纸 paper-card 底（不是纯白）
 * - 显示字标题 + 正文字消息
 * - 矩形扁按钮，paper-rule 边线
 * - 底层 mask 走 paper-stamp 暗调而不是纯黑
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'destructive',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const confirmTokens =
    variant === 'destructive'
      ? {
          bg: 'var(--color-type-debate)',
          bgHover: 'var(--color-type-debate-deep)',
        }
      : {
          bg: 'var(--color-type-dialogue)',
          bgHover: 'var(--color-type-dialogue-deep)',
        };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'var(--mask-primary)' }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="w-[400px] max-w-full overflow-hidden border"
        style={{
          background: 'var(--color-paper-card)',
          borderColor: 'var(--color-paper-edge)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-7 pt-7 pb-6">
          <h3
            id="confirm-title"
            className="font-display text-[20px] font-medium leading-tight mb-3"
            style={{ color: 'var(--color-ink-1)' }}
          >
            {title}
          </h3>
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: 'var(--color-ink-2)' }}
          >
            {message}
          </p>
        </div>

        <div
          className="flex border-t"
          style={{ borderTopColor: 'var(--color-paper-rule)' }}
        >
          <button
            onClick={onCancel}
            className="flex-1 py-4 text-[14px] font-medium transition-colors hover:bg-[var(--color-paper-soft)]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 border-l py-4 text-[14px] font-medium text-white transition-colors"
            style={{
              borderLeftColor: 'var(--color-paper-rule)',
              background: confirmTokens.bg,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = confirmTokens.bgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = confirmTokens.bg)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
