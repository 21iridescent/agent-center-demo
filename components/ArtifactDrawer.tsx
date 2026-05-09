'use client';

import { Fragment, useMemo, useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { exportMarkdownAsDocx } from '@/lib/word-export';
import { findEditPosition, type AnchorType } from '@/lib/canvas-edit';

export interface PendingEdit {
  callId: string;
  find: string;
  replace: string;
  reason: string;
  anchorType: AnchorType;
}

interface Props {
  open: boolean;
  source: string;                          // 当前 artifact markdown
  filename: string;                        // 导出 .docx 用文件名（不含扩展名）
  onSourceChange: (next: string) => void;  // 用户编辑回调；PrepToolPage 持有 state
  onClose: () => void;
  /** AI 通过 editCanvas 提出的待审改动（pending） */
  pendingEdits?: PendingEdit[];
  onApplyEdit?: (callId: string) => void;
  onRejectEdit?: (callId: string) => void;
}

/**
 * Artifact 侧栏 · push 布局（chat 主栏同步收窄）
 * - 三档状态：浏览（markdown render）/ 编辑（textarea）/ 导出中（按钮 disabled）
 * - editCanvas 来的"待审改动"：能定位的【inline 嵌入到 markdown 渲染流里】(原位)；
 *   定位不到的（文档已改动）落到顶部"孤立改动"小区域只能撤销
 * - 540px 桌面写死；mobile 由父布局降回单栏
 */
export function ArtifactDrawer({
  open,
  source,
  filename,
  onSourceChange,
  onClose,
  pendingEdits,
  onApplyEdit,
  onRejectEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 把 source 按 pending edits 的 find 位置切片：
  // [text 段, edit 卡, text 段, edit 卡, ..., text 段]
  // 同时分离出"找不到 find"的孤立改动（只能撤销）
  const { segments, orphanEdits } = useMemo(
    () => buildSegments(source, pendingEdits ?? []),
    [source, pendingEdits],
  );

  if (!open) return null;

  const pendingCount = (pendingEdits ?? []).length;

  async function handleExport() {
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

  return (
    <aside
      className="flex flex-col overflow-hidden border-l"
      style={{
        width: '100%',
        background: 'var(--color-paper-base)',
        borderColor: 'var(--color-paper-rule)',
        height: 'calc(100vh - var(--topbar-height))',
      }}
      aria-label="稿件侧栏"
    >
      <header
        className="flex items-center gap-3 border-b px-5 py-3 shrink-0"
        style={{ borderColor: 'var(--color-paper-rule)' }}
      >
        <span
          className="font-numeric text-[10px] uppercase tracking-[0.16em]"
          style={{ color: 'var(--color-ink-mute)' }}
        >
          DRAFT
        </span>
        <span
          className="font-display text-[14px] font-medium truncate"
          style={{ color: 'var(--color-ink-1)' }}
          title={filename}
        >
          {filename}
        </span>
        {pendingCount > 0 && (
          <span
            className="font-numeric text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5"
            style={{
              background: 'var(--color-warn-bg)',
              color: 'var(--color-warn)',
              border: '1px solid var(--color-warn-edge)',
              borderRadius: 'var(--radius-xs)',
            }}
          >
            {pendingCount} 待审
          </span>
        )}
        <button
          onClick={onClose}
          className="ml-auto font-numeric text-[11px] uppercase tracking-[0.14em] transition-colors hover:[color:var(--color-ink-1)]"
          style={{ color: 'var(--color-ink-3)' }}
          aria-label="关闭稿件"
        >
          收起
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 孤立改动 —— find 在 source 里找不到，无法 inline 显示 */}
        {!editing && orphanEdits.length > 0 && (
          <div
            className="border-b px-5 py-3 flex flex-col gap-2"
            style={{
              background: 'var(--color-warn-bg)',
              borderBottomColor: 'var(--color-paper-rule)',
            }}
          >
            <div
              className="font-numeric text-[10px] uppercase tracking-[0.16em]"
              style={{ color: 'var(--color-warn)' }}
            >
              ⚠ {orphanEdits.length} 处改动无法定位（文档已改动）
            </div>
            {orphanEdits.map(edit => (
              <PendingEditCard
                key={edit.callId}
                edit={edit}
                found={false}
                onApply={() => onApplyEdit?.(edit.callId)}
                onReject={() => onRejectEdit?.(edit.callId)}
              />
            ))}
          </div>
        )}

        <div className="px-6 py-5">
          {editing ? (
            <textarea
              value={source}
              onChange={e => onSourceChange(e.target.value)}
              className="min-h-[60vh] w-full resize-none bg-transparent text-[13px] leading-[1.7] outline-none"
              style={{ color: 'var(--color-ink-1)', fontFamily: 'inherit' }}
              spellCheck={false}
            />
          ) : source ? (
            // 把 segments 按时间线渲：text 段走 MarkdownRenderer，edit 段在原位渲卡
            <>
              {segments.map((seg, i) =>
                seg.type === 'text' ? (
                  <Fragment key={`t-${i}`}>
                    {seg.content && <MarkdownRenderer source={seg.content} />}
                  </Fragment>
                ) : (
                  <PendingEditCard
                    key={seg.edit.callId}
                    edit={seg.edit}
                    found={true}
                    onApply={() => onApplyEdit?.(seg.edit.callId)}
                    onReject={() => onRejectEdit?.(seg.edit.callId)}
                  />
                ),
              )}
            </>
          ) : (
            <div
              className="flex h-full items-center justify-center text-[12px] py-20"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              等 AI 出第一稿…
            </div>
          )}
        </div>
      </div>

      <footer
        className="flex items-center gap-2 border-t px-5 py-3 shrink-0"
        style={{ borderColor: 'var(--color-paper-rule)' }}
      >
        <button
          onClick={() => setEditing(e => !e)}
          disabled={!source}
          className="font-display flex h-9 items-center gap-1.5 px-3 text-[12.5px] font-medium disabled:opacity-50"
          style={{
            background: editing ? 'var(--color-paper-stamp)' : 'var(--color-paper-card)',
            color: editing ? 'var(--color-paper-base)' : 'var(--color-ink-1)',
            border: '1px solid var(--color-paper-rule)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {editing ? '完成' : '编辑'}
        </button>
        <button
          onClick={handleExport}
          disabled={!source || exporting}
          className="font-display flex h-9 items-center gap-1.5 px-3 text-[12.5px] font-medium disabled:opacity-50"
          style={{
            background: 'var(--color-paper-card)',
            color: 'var(--color-ink-1)',
            border: '1px solid var(--color-paper-rule)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span aria-hidden>⬇</span>
          <span>{exporting ? '导出中…' : '导出 Word'}</span>
        </button>
      </footer>
    </aside>
  );
}

type Segment =
  | { type: 'text'; content: string }
  | { type: 'edit'; edit: PendingEdit };

/**
 * 把 source 按 pending edits 的 find 位置切片成段。
 * - 找不到 find 的 edit → 进入 orphanEdits（顶部孤立显示，只能撤销）
 * - find 重叠时（前一条 edit 的 find 区间已经覆盖到 idx 之前）→ 也算 orphan
 * - 找得到的按 idx 升序间插到 text 段之间
 */
function buildSegments(
  source: string,
  pendingEdits: PendingEdit[],
): { segments: Segment[]; orphanEdits: PendingEdit[] } {
  if (!source || pendingEdits.length === 0) {
    return { segments: [{ type: 'text', content: source }], orphanEdits: [] };
  }

  // 走 fuzzy 定位 — exact 失败时归一化空白后再匹配，避免 AI 写出来的 find
  // 多/少一个空格就被 orphan 掉。section 模式按 heading 锚定整节。
  const positioned = pendingEdits
    .map(edit => {
      const pos = findEditPosition(source, edit.find, edit.anchorType);
      return {
        edit,
        start: pos?.start ?? -1,
        end: pos?.end ?? -1,
      };
    })
    .sort((a, b) => {
      if (a.start < 0 && b.start < 0) return 0;
      if (a.start < 0) return 1; // 找不到的丢后面
      if (b.start < 0) return -1;
      return a.start - b.start;
    });

  const segments: Segment[] = [];
  const orphanEdits: PendingEdit[] = [];
  let cursor = 0;

  for (const p of positioned) {
    if (p.start < 0) {
      orphanEdits.push(p.edit);
      continue;
    }
    if (p.start < cursor) {
      // find 区间与上一条 edit 重叠 —— 当 orphan 处理
      orphanEdits.push(p.edit);
      continue;
    }
    if (p.start > cursor) {
      segments.push({ type: 'text', content: source.slice(cursor, p.start) });
    }
    segments.push({ type: 'edit', edit: p.edit });
    cursor = p.end;
  }
  if (cursor < source.length) {
    segments.push({ type: 'text', content: source.slice(cursor) });
  }
  return { segments, orphanEdits };
}

/**
 * 待审改动卡片
 * - found=true：inline 渲染（嵌在 markdown 流里，替代 find 位置）
 * - found=false：orphan 渲染（顶部小区，只能撤销）
 * - 头部：✏️ 改稿 · {reason}
 * - 中间：原文（红 + 删除线） / 改为（绿）两栏
 * - 底部：[应用] [撤销]
 */
function PendingEditCard({
  edit,
  found,
  onApply,
  onReject,
}: {
  edit: PendingEdit;
  found: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  const replaceIsDelete = edit.replace.length === 0;

  return (
    <div
      className="border flex flex-col gap-2 px-3.5 py-2.5 my-3"
      style={{
        background: 'var(--color-paper-card)',
        borderColor: 'var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-baseline gap-2 min-w-0">
        <span aria-hidden>✏️</span>
        <span
          className="font-display text-[12.5px] font-medium shrink-0"
          style={{ color: 'var(--color-ink-1)' }}
        >
          AI 提议改稿
        </span>
        {edit.anchorType === 'section' && (
          <span
            className="font-numeric shrink-0 px-1.5 py-[1px] text-[10px] uppercase tracking-[0.14em]"
            style={{
              background: 'var(--color-type-dialogue-bg)',
              color: 'var(--color-type-dialogue-deep)',
              borderRadius: 'var(--radius-xs)',
            }}
            title="按 heading 锚定整节替换：find 是 heading 行，改动范围包含该节全部内容"
          >
            整节
          </span>
        )}
        {edit.reason && (
          <span
            className="text-[11.5px] truncate"
            style={{ color: 'var(--color-ink-3)' }}
          >
            · {edit.reason}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 text-[12px] leading-[1.6]">
        <div
          className="border-l-2 px-2 py-1.5"
          style={{
            background: 'var(--color-type-debate-bg)',
            borderLeftColor: 'var(--color-type-debate)',
            color: 'var(--color-ink-3)',
          }}
        >
          <span
            className="font-numeric text-[10px] uppercase tracking-[0.14em] mr-2"
            style={{ color: 'var(--color-type-debate-deep)' }}
          >
            {edit.anchorType === 'section' ? 'heading 锚' : '原文'}
          </span>
          <span
            style={{
              textDecoration: 'line-through',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {edit.find}
          </span>
          {edit.anchorType === 'section' && (
            <div
              className="mt-1 text-[10.5px]"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              ↳ 替换范围 = 该 heading 到下一同级 heading 之间的整节内容
            </div>
          )}
        </div>
        <div
          className="border-l-2 px-2 py-1.5"
          style={{
            background: 'var(--color-launch-bg)',
            borderLeftColor: 'var(--color-launch)',
            color: 'var(--color-ink-1)',
          }}
        >
          <span
            className="font-numeric text-[10px] uppercase tracking-[0.14em] mr-2"
            style={{ color: 'var(--color-launch-deep)' }}
          >
            改为
          </span>
          {replaceIsDelete ? (
            <span style={{ color: 'var(--color-ink-3)', fontStyle: 'italic' }}>
              （删除该片段）
            </span>
          ) : (
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {edit.replace}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={onApply}
          disabled={!found}
          className="font-display flex h-7 items-center gap-1 px-2.5 text-[11.5px] font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'var(--color-launch-deep)',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          <span aria-hidden>✓</span>
          <span>应用</span>
        </button>
        <button
          onClick={onReject}
          className="font-display flex h-7 items-center gap-1 px-2.5 text-[11.5px] font-medium"
          style={{
            background: 'var(--color-paper-soft)',
            color: 'var(--color-ink-2)',
            border: '1px solid var(--color-paper-rule)',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          <span aria-hidden>✕</span>
          <span>撤销</span>
        </button>
      </div>
    </div>
  );
}
