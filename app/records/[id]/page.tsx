import { notFound } from 'next/navigation';
import { getRecord } from '@/lib/kv';
import { FALLBACK_RECORDS } from '@/lib/fallback-records';
import { Topbar } from '@/components/Topbar';
import { DialogueReplayPage } from '@/components/DialogueReplayPage';
import { DebateReplayPage } from '@/components/DebateReplayPage';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { CitationsPanel } from '@/components/CitationsPanel';
import { PrepExportButton } from '@/components/PrepExportButton';
import { PREP_KIND_LABEL, PREP_KIND_TO_PATH, type AppRecord, type PrepRecord } from '@/lib/types';
import Link from 'next/link';

/**
 * /records/[id] — 记录详情 SSR 入口
 *
 * - Next 16 dynamic params 是 Promise，必须 await（同 app/use/xuewen/[id]/page.tsx）
 * - 真实记录走 KV；KV miss 时降级查 FALLBACK_RECORDS（让 demo 卡也能点开）
 * - 不存在 → notFound()
 * - 按 type 分发：dialogue/debate/prep 各有专属视图；discussion 仍占位
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let record: AppRecord | null = null;
  try {
    record = await getRecord(id);
  } catch {
    // KV 不可用时静默走 fallback，不挂详情页
    record = null;
  }
  if (!record) {
    record = FALLBACK_RECORDS.find(r => r.id === id) ?? null;
  }
  if (!record) notFound();

  if (record.type === 'dialogue') {
    return <DialogueReplayPage record={record} />;
  }
  if (record.type === 'debate') {
    return <DebateReplayPage record={record} />;
  }
  if (record.type === 'prep') {
    return <PrepReplayPage record={record} />;
  }

  // discussion — 暂不支持回看
  return <UnsupportedReplay title={record.title} type={record.type} />;
}

/** 备课产出回看：标题 + meta（学科/年级/课题）+ 全文 */
function PrepReplayPage({ record }: { record: PrepRecord }) {
  const kindLabel = PREP_KIND_LABEL[record.kind];
  const toolPath = PREP_KIND_TO_PATH[record.kind];
  const metaEntries = Object.entries(record.meta ?? {}).filter(([, v]) => !!v);

  return (
    <>
      <Topbar crumb={`回看 · ${record.title}`} />
      <main
        className="mx-auto w-full px-10 pt-8 pb-16"
        style={{ maxWidth: 'var(--container-list)' }}
      >
        <header
          className="mb-6 flex items-end gap-5 border-t pt-5"
          style={{ borderColor: 'var(--color-paper-rule)' }}
        >
          <span
            className="stamp h-10 w-10 shrink-0 text-[12px]"
            style={{ borderRadius: 'var(--radius-xs)' }}
            aria-hidden
          >
            {kindLabel.slice(0, 2)}
          </span>
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            <div
              className="font-numeric text-[10px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--color-type-dialogue-deep)' }}
            >
              备课产出 · {kindLabel}
            </div>
            <h1
              className="font-display text-[26px] font-medium leading-tight tracking-[0.5px]"
              style={{ color: 'var(--color-ink-1)' }}
            >
              {record.title}
            </h1>
            {metaEntries.length > 0 && (
              <div
                className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]"
                style={{ color: 'var(--color-ink-3)' }}
              >
                {metaEntries.map(([k, v], i) => (
                  <span key={k} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>·</span>
                    )}
                    <span style={{ color: 'var(--color-ink-mute)' }}>{k}</span>
                    <span>{v}</span>
                  </span>
                ))}
                {record.agentName && (
                  <>
                    <span aria-hidden style={{ color: 'var(--color-ink-faint)' }}>·</span>
                    <span style={{ color: 'var(--color-ink-mute)' }}>来自</span>
                    <span>{record.agentName}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PrepExportButton source={record.content ?? ''} filename={record.title} />
            <Link
              href={toolPath}
              className="rounded-md border px-3 py-1.5 text-[12px] transition-colors hover:border-[var(--color-type-dialogue-deep)] hover:text-[var(--color-type-dialogue-deep)]"
              style={{ borderColor: 'var(--color-paper-edge)', color: 'var(--color-ink-3)' }}
            >
              回到 {kindLabel} 工具 →
            </Link>
          </div>
        </header>

        {record.content ? (
          <>
            <article
              className="rounded-md border bg-white px-6 py-5"
              style={{ borderColor: 'var(--color-paper-edge)' }}
            >
              <div className="text-[14px]" style={{ color: 'var(--color-ink-1)' }}>
                <MarkdownRenderer source={record.content} />
              </div>
            </article>

            {record.citations && record.citations.length > 0 && (
              <div className="mt-5">
                <CitationsPanel citations={record.citations} />
              </div>
            )}
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
            style={{
              background: 'var(--color-paper-soft)',
              border: '1px solid var(--color-paper-edge)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div className="font-display text-[16px] font-medium" style={{ color: 'var(--color-ink-2)' }}>
              这条记录没有正文
            </div>
            <div className="text-[12px]" style={{ color: 'var(--color-ink-3)' }}>
              可能是早期版本保存的占位记录；正文字段已在新版加上，重新生成并保存即可。
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function UnsupportedReplay({ title, type }: { title: string; type: string }) {
  const reason =
    type === 'discussion'
      ? '讨论使用页尚未上线，暂时无法回看。'
      : '该类型记录暂不支持回看。';
  return (
    <>
      <Topbar crumb={`回看 · ${title}`} />
      <main
        className="mx-auto w-full px-10 pt-12 pb-16"
        style={{ maxWidth: 'var(--container-list)' }}
      >
        <div
          className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center"
          style={{
            background: 'var(--color-paper-soft)',
            border: '1px solid var(--color-paper-edge)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span
            className="stamp h-10 w-10 text-[12px]"
            style={{
              borderRadius: 'var(--radius-xs)',
              background: 'var(--color-paper-edge)',
              color: 'var(--color-ink-mute)',
            }}
            aria-hidden
          >
            ø
          </span>
          <div
            className="font-display text-[18px] font-medium"
            style={{ color: 'var(--color-ink-2)' }}
          >
            该类型记录暂不支持回看
          </div>
          <div className="text-[13px]" style={{ color: 'var(--color-ink-3)' }}>
            {reason}
          </div>
        </div>
      </main>
    </>
  );
}
