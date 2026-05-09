'use client';

import type { Citation } from '@/lib/types';

interface Props {
  citations: Citation[];
}

/**
 * 引用面板 · assistant 消息末尾
 * - paper-soft 底，与 reasoning 详情同款 details
 * - 默认展开（open）；条数 0 时整个不渲染
 */
export function CitationsPanel({ citations }: Props) {
  if (!citations.length) return null;

  return (
    <details
      className="self-start ml-[44px] max-w-[640px] border"
      style={{
        background: 'var(--color-paper-soft)',
        borderColor: 'var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
      }}
      open
    >
      <summary
        className="cursor-pointer px-4 py-2 font-numeric text-[11px] uppercase tracking-[0.14em] select-none"
        style={{ color: 'var(--color-ink-3)' }}
      >
        引用 · {citations.length} 条
      </summary>
      <ol
        className="px-4 pb-3 pt-1 text-[12px] leading-[1.7] flex flex-col gap-1"
        style={{ color: 'var(--color-ink-2)' }}
      >
        {citations.map((c, i) => (
          <li key={c.url} className="flex items-baseline gap-2">
            <span
              className="font-numeric"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              [{i + 1}]
            </span>
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 truncate"
              style={{ color: 'var(--color-type-dialogue)' }}
              title={c.url}
            >
              {c.title || c.url}
            </a>
            {c.snippet && (
              <span
                className="ml-auto text-[11px] truncate"
                style={{
                  color: 'var(--color-ink-mute)',
                  maxWidth: '50%',
                }}
                title={c.snippet}
              >
                {c.snippet.slice(0, 70)}
                {c.snippet.length > 70 ? '…' : ''}
              </span>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** 从 messages 抽 citations — 与 PrepToolPage.handleSave 共享逻辑 */
export function extractCitations(
  messages: { parts?: Array<{ type: string; state?: string; output?: unknown }> }[],
): Citation[] {
  const seen = new Map<string, Citation>();
  for (const m of messages) {
    for (const p of m.parts ?? []) {
      if (p.state !== 'output-available' || !p.output) continue;
      if (p.type === 'tool-webSearch' || p.type === 'tool-findSimilar') {
        const arr = p.output as Array<{
          url: string;
          title: string;
          snippet?: string;
          publishedDate?: string;
        }>;
        if (!Array.isArray(arr)) continue;
        for (const r of arr) {
          if (r?.url && !seen.has(r.url)) {
            seen.set(r.url, {
              url: r.url,
              title: r.title,
              snippet: r.snippet,
              publishedDate: r.publishedDate,
            });
          }
        }
      } else if (p.type === 'tool-crawlUrl') {
        const r = p.output as { url: string; title: string };
        if (r?.url && !seen.has(r.url)) {
          seen.set(r.url, { url: r.url, title: r.title });
        }
      }
    }
  }
  return [...seen.values()];
}
