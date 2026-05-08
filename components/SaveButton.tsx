'use client';

interface Props {
  saved: boolean;
  saving?: boolean;
  onSave: () => void;
}

export function SaveButton({ saved, saving, onSave }: Props) {
  return (
    <>
      <span
        className="text-[12px]"
        style={{ color: saved ? 'var(--color-success)' : 'var(--color-text-5)' }}
      >
        {saving ? '保存中…' : saved ? '已保存 ✓' : '未保存'}
      </span>
      <button
        onClick={onSave}
        disabled={saving}
        className="h-8 rounded-md px-4 text-[13px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: 'var(--color-primary)' }}
      >
        保存到我的记录
      </button>
    </>
  );
}
