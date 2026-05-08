import { notFound } from 'next/navigation';
import { getRecord } from '@/lib/kv';
import { FALLBACK_RECORDS } from '@/lib/fallback-records';
import { Topbar } from '@/components/Topbar';
import { DialogueReplayPage } from '@/components/DialogueReplayPage';
import { DebateReplayPage } from '@/components/DebateReplayPage';
import type { AppRecord } from '@/lib/types';

/**
 * /records/[id] — 记录详情 SSR 入口
 *
 * - Next 16 dynamic params 是 Promise，必须 await（同 app/use/xuewen/[id]/page.tsx）
 * - 真实记录走 KV；KV miss 时降级查 FALLBACK_RECORDS（让 demo 卡也能点开）
 * - 不存在 → notFound()
 * - 按 type 分发：dialogue/debate 各有专属 ReplayPage；prep/discussion 显示占位
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

  // prep / discussion — 暂不支持回看
  return <UnsupportedReplay title={record.title} type={record.type} />;
}

function UnsupportedReplay({ title, type }: { title: string; type: string }) {
  const reason =
    type === 'prep'
      ? '备课产出请回到对应工具页查看（习题 / 教案 / 大纲 / 活动）。'
      : '讨论使用页尚未上线，暂时无法回看。';
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
