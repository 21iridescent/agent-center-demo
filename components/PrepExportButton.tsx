'use client';

import { useState } from 'react';
import { exportMarkdownAsDocx } from '@/lib/word-export';

interface Props {
  source: string;
  filename: string;
  /** 'topbar' （主区单行 chip）/ 'inline' （回看页头部单按钮） */
  variant?: 'topbar' | 'inline';
}

/**
 * 单一职责：点一下，把 markdown 导出成 .docx 下载
 * - 复用在备课记录回看页（server component → 客户端按钮）
 * - 自带 loading + 错误兜底
 */
export function PrepExportButton({ source, filename, variant = 'inline' }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleClick() {
    if (exporting || !source) return;
    setExporting(true);
    try {
      await exportMarkdownAsDocx(source, filename);
    } catch (e) {
      console.error('export docx failed', e);
      alert('导出失败：' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const sizing =
    variant === 'topbar'
      ? 'h-8 px-3 text-[12.5px]'
      : 'rounded-md px-3 py-1.5 text-[12px]';

  return (
    <button
      onClick={handleClick}
      disabled={!source || exporting}
      className={`font-display flex items-center gap-1.5 font-medium disabled:opacity-50 transition-colors hover:[border-color:var(--color-type-dialogue-deep)] hover:[color:var(--color-type-dialogue-deep)] ${sizing}`}
      style={{
        background: 'var(--color-paper-card)',
        color: 'var(--color-ink-1)',
        border: '1px solid var(--color-paper-rule)',
        borderRadius: variant === 'topbar' ? 'var(--radius-sm)' : undefined,
      }}
      title="导出为 Word 文档"
    >
      <span aria-hidden>⬇</span>
      <span>{exporting ? '导出中…' : '导出 Word'}</span>
    </button>
  );
}
