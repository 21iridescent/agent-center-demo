'use client';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--mask-primary)' }}
      onClick={onCancel}
    >
      <div
        className="w-[360px] rounded-xl bg-white p-6"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-2 text-[16px] font-semibold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
        <p className="mb-5 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-3)' }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-4 py-1.5 text-[13px] transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-3)',
              background: 'white',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md px-4 py-1.5 text-[13px] font-medium text-white transition-colors"
            style={{ background: 'var(--color-debate)' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
