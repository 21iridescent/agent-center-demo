import Link from 'next/link';

interface Props {
  href: string;
  icon: string; // emoji or single character
  name: string;
  desc: string;
  tags: string[];
}

export function ToolCard({ href, icon, name, desc, tags }: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3.5 rounded-xl border bg-white p-5 transition-all hover:[box-shadow:var(--shadow-md)]"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md text-[18px]"
        style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}
      >
        {icon}
      </div>
      <div
        className="text-[14px] font-semibold leading-tight"
        style={{ color: 'var(--color-text)' }}
      >
        {name}
      </div>
      <div
        className="flex-1 text-[13px] leading-[1.55]"
        style={{ color: 'var(--color-text-3)' }}
      >
        {desc}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]" style={{ color: 'var(--color-text-5)' }}>
        {tags.map((t, i) => (
          <span key={t}>
            {i > 0 && <span className="mr-1.5" style={{ color: 'var(--color-text-7)' }}>·</span>}
            {t}
          </span>
        ))}
      </div>
      <button
        className="w-full rounded-md border bg-white py-1.5 text-[12px] font-medium transition-colors group-hover:bg-[var(--color-primary-bg)]"
        style={{
          color: 'var(--color-primary)',
          borderColor: 'var(--color-primary-border)',
        }}
      >
        打开使用
      </button>
    </Link>
  );
}
