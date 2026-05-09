'use client';

import Link from 'next/link';

interface Props {
  name: string;
  subject: string;
  grade: string;
  background: string;
  avatarUrl?: string;
  roleUrl?: string;
  voiceStyle?: string;
  knowledgeBases?: string[];
}

/**
 * 学问使用页左侧角色卡 (240 px sticky)
 * editorial filing-card style
 * - 顶部方形 avatar stamp
 * - 名字 display 字
 * - 学科/年级 paper-soft 标签
 * - 全身像 paper-soft 框
 * - 角色背景 / 知识库 / 音色 用 paper-rule 分段
 */
export function RoleCard({
  name,
  subject,
  grade,
  background,
  roleUrl,
  voiceStyle,
  knowledgeBases,
}: Props) {
  const fallbackChar = name.charAt(0);
  return (
    <aside
      className="sticky flex flex-col gap-4 overflow-hidden border"
      style={{
        background: 'var(--color-paper-card)',
        borderColor: 'var(--color-paper-edge)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-sm)',
        top: 'calc(var(--topbar-height) + 16px)',
        height: 'fit-content',
        maxHeight: 'calc(100vh - var(--topbar-height) - 32px)',
        overflowY: 'auto',
      }}
    >
      {/* 顶部章式横条 (学问蓝) */}
      <span
        aria-hidden
        className="block h-[3px] w-full"
        style={{ background: 'var(--color-type-dialogue)' }}
      />

      <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
        {/* 全身像 (主视觉) — 全宽 3:4 框,object-cover 充满,无重复头像 */}
        {roleUrl ? (
          <div
            className="relative overflow-hidden border"
            style={{
              borderColor: 'var(--color-paper-edge)',
              background: 'var(--color-paper-soft)',
              aspectRatio: '3 / 4',
              borderRadius: 'var(--radius-xs)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={roleUrl}
              alt={`${name} 全身像`}
              width={1024}
              height={1536}
              loading="lazy"
              className="h-full w-full object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
          </div>
        ) : (
          <div
            className="font-display flex items-center justify-center overflow-hidden text-[44px] font-bold"
            style={{
              aspectRatio: '3 / 4',
              background: 'var(--color-type-dialogue-bg)',
              color: 'var(--color-type-dialogue-deep)',
              border: '1px solid var(--color-paper-edge)',
              borderRadius: 'var(--radius-xs)',
            }}
          >
            {fallbackChar}
          </div>
        )}

        {/* 名字 + 学科/年级 chips · 左对齐显得像档案卡而非头像卡 */}
        <div className="flex flex-col gap-2">
          <div
            className="font-display text-[22px] font-medium leading-tight"
            style={{ color: 'var(--color-ink-1)' }}
          >
            {name}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span
              className="font-numeric px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]"
              style={{
                background: 'var(--color-paper-soft)',
                color: 'var(--color-ink-2)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {subject}
            </span>
            <span
              className="font-numeric px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]"
              style={{
                background: 'var(--color-paper-soft)',
                color: 'var(--color-ink-2)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {grade}
            </span>
          </div>
        </div>

        {/* 角色背景 */}
        <Section label="角色背景">
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: 'var(--color-ink-2)' }}
          >
            {background}
          </p>
        </Section>

        {/* 知识库 */}
        {knowledgeBases && knowledgeBases.length > 0 && (
          <Section label="关联知识库">
            <ul className="flex flex-col gap-1.5">
              {knowledgeBases.map(k => (
                <li
                  key={k}
                  className="flex items-baseline gap-2 text-[13px]"
                  style={{ color: 'var(--color-ink-2)' }}
                >
                  <span
                    aria-hidden
                    className="font-numeric text-[10px] shrink-0"
                    style={{ color: 'var(--color-ink-mute)' }}
                  >
                    —
                  </span>
                  <span className="truncate">{k}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* 音色 */}
        {voiceStyle && (
          <Section label="语音">
            <p
              className="text-[13px]"
              style={{ color: 'var(--color-ink-2)' }}
            >
              {voiceStyle}
            </p>
          </Section>
        )}

        {/* 编辑入口 */}
        <Link
          href="/create"
          className="font-numeric mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] uppercase tracking-[0.14em] transition-colors hover:bg-[var(--color-paper-soft)]"
          style={{
            border: '1px solid var(--color-paper-edge)',
            color: 'var(--color-ink-3)',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          <span aria-hidden>↩</span>
          <span>重新创建</span>
        </Link>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="border-t pt-3"
      style={{ borderTopColor: 'var(--color-paper-rule)' }}
    >
      <div
        className="font-numeric mb-2 text-[10px] uppercase tracking-[0.16em]"
        style={{ color: 'var(--color-ink-mute)' }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
