'use client';

import { Topbar } from './Topbar';
import {
  getDebateActor,
  getBackground,
  getTopicThumb,
  DEBATE_JUDGE_AVATAR,
} from '@/lib/asset-catalog';
import type { DebateRecord } from '@/lib/types';

interface Props {
  record: DebateRecord;
}

/**
 * 辩论实录回看 — 只读视图
 *
 * 拷贝 DebateUsePage 中 phase==='judged' 形态下的展示子集：
 *   辩题条 / 双方 Fighter / 评委卡 / 历史实录
 * 删去：状态机 / streamFetch / 操作按钮 / 输入框 / 倒计时
 *
 * 元数据从 record.meta 拼（proActorId / conActorId / thumbAsset / bgAsset / totalRounds 是
 * Task 2 在 endAndSave 时持久化进去的）。早期记录无这些字段时全部走 ?? 兜底。
 */
export function DebateReplayPage({ record }: Props) {
  const t = record.transcript;
  const history = t?.history ?? [];
  const judgeText = t?.judgeText ?? '';
  const score = t?.score;

  const meta = record.meta ?? {};
  const proActor = getDebateActor(meta.proActorId);
  const conActor = getDebateActor(meta.conActorId);
  const bg = getBackground('debate', meta.bgAsset);
  const thumb = getTopicThumb(meta.thumbAsset);

  const proCount = record.pro ?? history.filter(h => h.side === 'pro').length;
  const conCount = record.con ?? history.filter(h => h.side === 'con').length;
  const totalRounds = parseTotalRounds(
    meta.totalRounds,
    history.length > 0 ? Math.max(...history.map(h => h.round)) : 0,
  );

  return (
    <>
      <Topbar crumb={`回看 · ${record.title}`} />
      <main
        className="relative mx-auto w-full px-6 py-6 pb-12"
        style={{ maxWidth: 'var(--container-wide)' }}
      >
        {/* 背景水印 */}
        {bg && (
          <div
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            style={{ opacity: 0.05 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bg.src}
              alt=""
              className="h-full w-full object-cover"
              aria-hidden
            />
          </div>
        )}

        {/* 辩题条 */}
        <div
          className="mb-4 flex items-center gap-4 border p-4"
          style={{
            background: 'var(--color-paper-card)',
            borderColor: 'var(--color-paper-edge)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {thumb && (
            <div
              className="shrink-0 overflow-hidden"
              style={{
                width: 96,
                height: 54,
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb.src}
                alt={thumb.label}
                width={640}
                height={360}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div
              className="font-display text-[16px] font-medium leading-tight"
              style={{ color: 'var(--color-ink-1)' }}
            >
              <span style={{ color: 'var(--color-type-debate-deep)' }}>
                辩题
              </span>{' '}
              · {record.title}
            </div>
            <div
              className="mt-1 flex items-center gap-2 text-[11px]"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              {meta.subject && <span>{meta.subject}</span>}
              {meta.subject && <span>·</span>}
              {meta.grade && <span>{meta.grade}</span>}
              {(meta.subject || meta.grade) && totalRounds > 0 && <span>·</span>}
              {totalRounds > 0 && <span>共 {totalRounds} 轮</span>}
            </div>
          </div>
          {/* 进度点 — 全亮（已完成） */}
          {totalRounds > 0 && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalRounds }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--color-type-debate-deep)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 擂台 — 双方静态卡 */}
        <div
          className="mb-4 grid items-start gap-6 border p-6"
          style={{
            background: 'var(--color-paper-card)',
            borderColor: 'var(--color-paper-edge)',
            borderRadius: 'var(--radius-sm)',
            gridTemplateColumns: '1fr 120px 1fr',
          }}
        >
          <ReplayFighter
            sideLabel="正方"
            kindLabel={proActor?.kind === 'human' ? '学生' : 'AI'}
            roleUrl={proActor?.role}
            color="var(--color-type-dialogue-deep)"
            colorBg="var(--color-type-dialogue-bg)"
          />
          <div className="flex items-center justify-center pt-32">
            <div
              className="font-display flex h-20 w-20 items-center justify-center text-[18px] font-bold"
              style={{
                border: '3px dashed var(--color-type-debate-deep)',
                color: 'var(--color-type-debate-deep)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              VS
            </div>
          </div>
          <ReplayFighter
            sideLabel="反方"
            kindLabel={conActor?.kind === 'human' ? '学生' : 'AI'}
            roleUrl={conActor?.role}
            color="var(--color-type-debate-deep)"
            colorBg="var(--color-type-debate-bg)"
          />
        </div>

        {/* 评委卡（写死 judged 形态） */}
        {judgeText ? (
          <div
            className="mb-4 border p-5"
            style={{
              background: 'var(--color-paper-soft)',
              borderColor: 'var(--color-paper-edge)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div
                className="h-9 w-9 overflow-hidden"
                style={{
                  background: 'var(--color-paper-edge)',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={DEBATE_JUDGE_AVATAR}
                  alt="评委"
                  width={512}
                  height={512}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <div
                  className="font-display text-[13px] font-semibold"
                  style={{ color: 'var(--color-ink-1)' }}
                >
                  AI 评委 · 已点评
                </div>
              </div>
              {typeof score === 'number' && (
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-numeric tnum text-[28px] font-bold"
                    style={{ color: 'var(--color-type-debate-deep)' }}
                  >
                    {score.toFixed(1)}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: 'var(--color-ink-mute)' }}
                  >
                    / 10
                  </span>
                </div>
              )}
            </div>
            <div
              className="whitespace-pre-wrap text-[13px] leading-relaxed"
              style={{ color: 'var(--color-ink-1)' }}
            >
              {judgeText}
            </div>
          </div>
        ) : (
          <EmptyJudge />
        )}

        {/* 历史实录 */}
        {history.length > 0 ? (
          <div
            className="border p-5"
            style={{
              background: 'var(--color-paper-card)',
              borderColor: 'var(--color-paper-edge)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div
              className="font-numeric mb-3 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--color-ink-mute)' }}
            >
              辩论实录（{history.length} 段发言 · 正方 {proCount} · 反方 {conCount}）
            </div>
            <div className="flex flex-col gap-3">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex gap-2.5 border-b pb-3 last:border-b-0 last:pb-0"
                  style={{ borderColor: 'var(--color-paper-rule)' }}
                >
                  <div
                    className="font-numeric flex h-7 shrink-0 items-center px-2 text-[11px] font-semibold"
                    style={{
                      background:
                        h.side === 'pro'
                          ? 'var(--color-type-dialogue-bg)'
                          : 'var(--color-type-debate-bg)',
                      color:
                        h.side === 'pro'
                          ? 'var(--color-type-dialogue-deep)'
                          : 'var(--color-type-debate-deep)',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    第 {h.round} 轮 · {h.side === 'pro' ? '正方' : '反方'}
                  </div>
                  <div
                    className="flex-1 whitespace-pre-wrap text-[13px] leading-relaxed"
                    style={{ color: 'var(--color-ink-1)' }}
                  >
                    {h.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyHistory />
        )}
      </main>
    </>
  );
}

function parseTotalRounds(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

interface ReplayFighterProps {
  sideLabel: string;
  kindLabel: string;
  roleUrl?: string;
  color: string;
  colorBg: string;
}

function ReplayFighter({
  sideLabel,
  kindLabel,
  roleUrl,
  color,
  colorBg,
}: ReplayFighterProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex items-center gap-2">
        <span
          className="font-numeric px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{
            background: colorBg,
            color,
            borderRadius: 'var(--radius-xs)',
          }}
        >
          {sideLabel}
        </span>
        <span className="text-[12px]" style={{ color: 'var(--color-ink-mute)' }}>
          {kindLabel}
        </span>
      </div>
      {roleUrl ? (
        <div
          className="overflow-hidden"
          style={{
            width: '100%',
            maxWidth: 280,
            aspectRatio: '2 / 3',
            background: colorBg,
            border: '2px solid var(--color-paper-edge)',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roleUrl}
            alt={sideLabel}
            width={1024}
            height={1536}
            loading="lazy"
            className="h-full w-full object-cover object-top"
          />
        </div>
      ) : (
        <div
          className="font-display flex items-center justify-center text-[36px] font-bold"
          style={{
            width: '100%',
            maxWidth: 280,
            aspectRatio: '2 / 3',
            background: colorBg,
            color,
            border: `2px dashed ${color}`,
            borderRadius: 'var(--radius-xs)',
          }}
        >
          ?
        </div>
      )}
    </div>
  );
}

function EmptyJudge() {
  return (
    <div
      className="mb-4 px-6 py-12 text-center text-[13px]"
      style={{
        background: 'var(--color-paper-soft)',
        border: '1px solid var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--color-ink-mute)',
      }}
    >
      该场辩论无评委点评（早期保存未带 transcript）
    </div>
  );
}

function EmptyHistory() {
  return (
    <div
      className="px-6 py-12 text-center text-[13px]"
      style={{
        background: 'var(--color-paper-soft)',
        border: '1px solid var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--color-ink-mute)',
      }}
    >
      该场辩论无实录原文（早期保存未带 transcript）
    </div>
  );
}
