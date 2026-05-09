'use client';

import { Fragment, type ReactNode } from 'react';

interface Props {
  toolType: string;       // 'tool-webSearch' / 'tool-findMisconceptions' / …
  state?: string;         // 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

/**
 * 备课 agent 工具调用的状态条（可展开）
 * - input-streaming：「正在调用 …」+ pulse dot —— 不可展开
 * - input-available：「执行 …」（input 已确定，execute 还没回）—— 不可展开
 * - output-available：「✓ 完成（N 条）」—— 可点开看完整 output
 * - output-error：「✗ 失败」—— 可点开看 errorText 详情
 */

const PREP_TOOL_LABELS: Record<string, { icon: string; label: string }> = {
  // v2 主用：真联网 + canvas 写入
  'tool-webSearch':         { icon: '🔍', label: '搜索' },
  'tool-crawlUrl':          { icon: '📄', label: '阅读' },
  'tool-findSimilar':       { icon: '🔗', label: '找相似' },
  'tool-writeCanvas':       { icon: '📝', label: '写入稿件' },
  'tool-editCanvas':        { icon: '✏️', label: '改稿（待审）' },
  // legacy 标签（保留以防老 message 还有；新流程不再调用）
  'tool-findMisconceptions':{ icon: '💡', label: '排查迷思' },
  'tool-findAnalogy':       { icon: '🧠', label: '想类比' },
  'tool-generateRubric':    { icon: '🎯', label: '生成量表' },
  'tool-materialsList':     { icon: '📦', label: '列材料' },
  'tool-safetyWarnings':    { icon: '⚠', label: '查安全' },
  'tool-timeBudget':        { icon: '⏱', label: '排时长' },
  'tool-matchCurriculum':   { icon: '📚', label: '对课标' },
  'tool-vocabularyList':    { icon: '🔤', label: '抽词汇' },
  'tool-generateMermaid':   { icon: '📐', label: '画图' },
  'tool-calculator':        { icon: '🧮', label: '计算' },
  'tool-unitConvert':       { icon: '⇄', label: '换单位' },
};

/* 常见 output 字段中文映射；缺省 fallback 到原 key */
const KEY_LABEL: Record<string, string> = {
  // findMisconceptions
  misconceptions: '迷思列表',
  misconception: '错误想法',
  why_it_persists: '为何持续',
  how_to_address: '怎么引导',
  // findAnalogy
  analogies: '类比列表',
  analogy: '类比',
  mapping: '映射',
  limitation: '局限',
  // matchCurriculum
  standard: '课标',
  version: '版本',
  objectives: '学习目标',
  hints: '教学提示',
  // timeBudget
  phases: '阶段列表',
  phase: '阶段',
  minutes: '分钟',
  focus: '重点',
  // vocabularyList
  terms: '词汇列表',
  term: '词',
  meaning: '解释',
  example: '例句',
  // materialsList
  materials: '材料清单',
  group_materials: '每组',
  class_materials: '全班',
  alternatives: '替代品',
  // safetyWarnings
  warnings: '风险列表',
  warning: '风险',
  severity: '严重度',
  mitigation: '缓解',
  // generateRubric
  achieved: '达成',
  partial: '部分达成',
  not_achieved: '未达成',
  objective: '目标',
  // common (web search / crawl)
  title: '标题',
  url: '链接',
  snippet: '摘要',
  publishedDate: '日期',
  text: '正文',
};

function prettyKey(k: string): string {
  return KEY_LABEL[k] ?? k;
}

function isPrimitive(v: unknown): boolean {
  return v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function RenderValue({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (value == null) return <span style={{ color: 'var(--color-ink-mute)' }}>—</span>;
  if (typeof value === 'string') {
    // URL → 可点击链接
    if (/^https?:\/\//.test(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted underline-offset-2 break-all"
          style={{ color: 'var(--color-type-dialogue)' }}
        >
          {value}
        </a>
      );
    }
    return (
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {value}
      </span>
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span style={{ fontFamily: 'var(--font-numeric)' }}>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: 'var(--color-ink-mute)' }}>(空)</span>;
    // 全是基本类型 → 顿号串联（如 ["A","B","C"]）
    if (value.every(isPrimitive)) {
      return <span>{value.map(x => String(x ?? '—')).join('、')}</span>;
    }
    return (
      <ol style={{ paddingLeft: 18, margin: 0, listStyle: 'decimal' }}>
        {value.map((x, i) => (
          <li key={i} style={{ marginBottom: depth === 0 ? 8 : 4, paddingLeft: 2 }}>
            <RenderValue value={x} depth={depth + 1} />
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span style={{ color: 'var(--color-ink-mute)' }}>(空)</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {entries.map(([k, val]) => {
          const nested = !isPrimitive(val) && !(Array.isArray(val) && val.every(isPrimitive));
          return (
            <div
              key={k}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: nested ? 'flex-start' : 'baseline',
              }}
            >
              <span
                className="font-numeric"
                style={{
                  color: 'var(--color-ink-mute)',
                  fontSize: '11px',
                  minWidth: 72,
                  flexShrink: 0,
                  letterSpacing: '0.04em',
                  paddingTop: nested ? 1 : 0,
                }}
              >
                {prettyKey(k)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <RenderValue value={val} depth={depth + 1} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

interface SummaryProps {
  meta: { icon: string; label: string };
  detail: string;
  status: string;
  statusColor: string;
  resultHint: string;
  isStreaming: boolean;
  isRunning: boolean;
  isError: boolean;
  errorText?: string;
  showChevron: boolean;
}

function SummaryContent({
  meta,
  detail,
  status,
  statusColor,
  resultHint,
  isStreaming,
  isRunning,
  isError,
  errorText,
  showChevron,
}: SummaryProps) {
  return (
    <Fragment>
      {(isStreaming || isRunning) && (
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ background: 'var(--color-ink-mute)' }}
        />
      )}
      <span aria-hidden>{meta.icon}</span>
      <span
        className="font-numeric text-[10px] uppercase tracking-[0.14em]"
        style={{ color: statusColor }}
      >
        {status}
      </span>
      <span className="font-display font-medium">{meta.label}</span>
      {detail && (
        <span style={{ color: 'var(--color-ink-3)' }} className="truncate">
          「{detail}」
        </span>
      )}
      {resultHint && (
        <span
          className="font-numeric text-[10px] uppercase tracking-[0.14em] ml-auto"
          style={{ color: 'var(--color-ink-mute)' }}
        >
          {resultHint}
        </span>
      )}
      {isError && errorText && (
        <span
          className="text-[11px] truncate"
          style={{ color: 'var(--color-type-debate)' }}
        >
          {errorText.slice(0, 40)}…
        </span>
      )}
      {showChevron && (
        <span
          aria-hidden
          className="chip-chevron font-numeric"
          style={{
            color: 'var(--color-ink-mute)',
            fontSize: 10,
            marginLeft: showChevron && resultHint ? 6 : 'auto',
            transition: 'transform 120ms ease',
          }}
        >
          ▾
        </span>
      )}
    </Fragment>
  );
}

export function ToolStatusChip({ toolType, state, input, output, errorText }: Props) {
  const meta = PREP_TOOL_LABELS[toolType];
  if (!meta) return null;

  const isStreaming = state === 'input-streaming';
  const isRunning = state === 'input-available';
  const isDone = state === 'output-available';
  const isError = state === 'output-error';

  // 简短描述：从 input 抓 query/topic/url 主键
  // writeCanvas 特殊：优先 summary，落到字数
  let detail = '';
  if (input && typeof input === 'object') {
    const i = input as Record<string, unknown>;
    if (toolType === 'tool-writeCanvas') {
      const sum = String(i.summary ?? '').trim();
      const md = String(i.markdown ?? '');
      detail = sum
        ? sum.replace(/\s+/g, ' ').slice(0, 40)
        : md
          ? `${md.length} 字`
          : '';
    } else {
      detail =
        String(
          i.query ?? i.topic ?? i.url ?? i.expression ?? i.activity ?? i.concept ?? i.objective ?? '',
        )
          .replace(/\s+/g, ' ')
          .slice(0, 40);
    }
  }

  // 结果数量：output 是数组就显示长度；object 取第一个数组字段；writeCanvas 看 length 字段
  let resultHint = '';
  if (isDone) {
    if (toolType === 'tool-writeCanvas' && output && typeof output === 'object') {
      const len = (output as { length?: number }).length;
      if (typeof len === 'number') resultHint = ` · ${len} 字`;
    } else if (Array.isArray(output)) {
      resultHint = ` · ${output.length} 条`;
    } else if (output && typeof output === 'object') {
      const arr = Object.values(output as Record<string, unknown>).find(v => Array.isArray(v));
      if (Array.isArray(arr)) resultHint = ` · ${arr.length} 条`;
    }
  }

  const status =
    isStreaming ? '正在' :
    isRunning ? '执行' :
    isDone ? '✓' :
    isError ? '✗' :
    '';

  const statusColor =
    isError ? 'var(--color-type-debate)' :
    isDone ? 'var(--color-launch-deep)' :
    'var(--color-ink-mute)';

  const expandable = isDone || isError;
  const containerStyle = {
    background: 'var(--color-paper-soft)',
    color: 'var(--color-ink-2)',
    border: '1px solid var(--color-paper-edge)',
    borderRadius: 'var(--radius-xs)',
    maxWidth: 640,
  } as const;

  const summaryClass =
    'flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer select-none';
  const summaryClassNonInteractive =
    'flex items-center gap-2 px-3 py-1.5 text-[12px]';

  if (!expandable) {
    return (
      <div className={`self-start ml-[44px] inline-flex ${summaryClassNonInteractive}`} style={containerStyle}>
        <SummaryContent
          meta={meta}
          detail={detail}
          status={status}
          statusColor={statusColor}
          resultHint={resultHint}
          isStreaming={isStreaming}
          isRunning={isRunning}
          isError={isError}
          errorText={errorText}
          showChevron={false}
        />
      </div>
    );
  }

  // 可展开形态：<details> + summary + body
  return (
    <details className="tool-chip self-start ml-[44px] block" style={containerStyle}>
      <summary className={summaryClass} style={{ listStyle: 'none' }}>
        <SummaryContent
          meta={meta}
          detail={detail}
          status={status}
          statusColor={statusColor}
          resultHint={resultHint}
          isStreaming={false}
          isRunning={false}
          isError={isError}
          errorText={errorText}
          showChevron={true}
        />
      </summary>
      <div
        className="border-t px-3 py-2.5 text-[12px] leading-[1.65]"
        style={{
          borderTopColor: 'var(--color-paper-rule)',
          background: 'var(--color-paper-card)',
          color: 'var(--color-ink-1)',
          maxHeight: 360,
          overflowY: 'auto',
        }}
      >
        {isError ? (
          <div style={{ color: 'var(--color-type-debate-deep)', whiteSpace: 'pre-wrap' }}>
            {errorText || '（无错误详情）'}
          </div>
        ) : (
          <RenderValue value={output} />
        )}
      </div>
      <style>{`
        .tool-chip > summary::-webkit-details-marker { display: none; }
        .tool-chip[open] .chip-chevron { transform: rotate(180deg); }
        .tool-chip > summary:hover { background: var(--color-paper-card); }
      `}</style>
    </details>
  );
}

/** 暴露给 ChatArea 用于决定哪些 tool-* 走通用 chip 渲染 */
export function isPrepToolType(type: string): boolean {
  return type in PREP_TOOL_LABELS;
}
