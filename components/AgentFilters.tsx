'use client';

const SUBJECTS = [
  { value: 'all',      label: '全部' },
  { value: '科学',     label: '科学' },
  { value: '人工智能', label: '人工智能' },
];

const GRADES = [
  { value: 'all',      label: '全部' },
  { value: '一年级',   label: '一' },
  { value: '二年级',   label: '二' },
  { value: '三年级',   label: '三' },
  { value: '四年级',   label: '四' },
  { value: '五年级',   label: '五' },
  { value: '六年级',   label: '六' },
];

const SORTS = [
  { value: 'lastUsed',  label: '上次使用' },
  { value: 'createdAt', label: '创建时间' },
];

interface Props {
  subject: string;
  grade: string;
  sort: string;
  resultHint?: string;
  onSubjectChange: (v: string) => void;
  onGradeChange: (v: string) => void;
  onSortChange: (v: string) => void;
}

/**
 * 全部智能体页的筛选条 · paper-card 浮纸 + 章式 stamp 选中态。
 *
 * 视觉语言完全复刻 components/FilterChips（active 章式黑底白字 / inactive 描边），
 * 但形态从单行单维度扩成多行带 label 的三维度（排序 / 学科 / 年级）。
 */
export function AgentFilters({
  subject,
  grade,
  sort,
  resultHint,
  onSubjectChange,
  onGradeChange,
  onSortChange,
}: Props) {
  return (
    <div
      className="mb-6 border px-5 py-1"
      style={{
        background: 'var(--color-paper-card)',
        borderColor: 'var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <Row label="排序" options={SORTS} current={sort} onChange={onSortChange} resultHint={resultHint} />
      <Row label="学科" options={SUBJECTS} current={subject} onChange={onSubjectChange} divider />
      <Row label="年级" options={GRADES} current={grade} onChange={onGradeChange} divider />
    </div>
  );
}

function Row({
  label,
  options,
  current,
  onChange,
  resultHint,
  divider,
}: {
  label: string;
  options: { value: string; label: string }[];
  current: string;
  onChange: (v: string) => void;
  resultHint?: string;
  divider?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 py-2.5"
      style={
        divider
          ? { borderTop: '1px solid var(--color-paper-rule)' }
          : undefined
      }
    >
      <span
        className="font-numeric mr-3 w-9 shrink-0 text-[11px] uppercase tracking-[0.14em]"
        style={{ color: 'var(--color-ink-mute)' }}
      >
        {label}
      </span>
      {options.map(o => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            style={
              active
                ? {
                    background: 'var(--color-paper-stamp)',
                    color: 'var(--color-paper-base)',
                    borderRadius: 'var(--radius-xs)',
                    letterSpacing: '0.2px',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--color-ink-2)',
                    border: '1px solid var(--color-paper-edge)',
                    borderRadius: 'var(--radius-xs)',
                  }
            }
          >
            {o.label}
          </button>
        );
      })}
      {resultHint && (
        <span
          className="font-numeric tnum ml-auto text-[12px]"
          style={{ color: 'var(--color-ink-mute)' }}
        >
          {resultHint}
        </span>
      )}
    </div>
  );
}
