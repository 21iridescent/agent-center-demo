'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Topbar } from './Topbar';
import { ContextStrip, type ContextField, type ContextParam } from './ContextStrip';
import { ChatArea } from './ChatArea';
import { ChatInput } from './ChatInput';
import { SaveButton } from './SaveButton';
import { CoursePicker } from './CoursePicker';
import { ArtifactDrawer } from './ArtifactDrawer';
import { useToast } from './Toast';
import type { PrepKind, Citation, ToolTraceEntry } from '@/lib/types';
import { PREP_KIND_TITLE_SUFFIX } from '@/lib/types';
import { exportMarkdownAsDocx } from '@/lib/word-export';

interface Props {
  toolName: string;
  kind: PrepKind;
  /** 初始上下文字段（课题/学科/年级）；用户可在 ContextStrip 编辑模式下改 */
  contextFields: { label: string; value: string; options?: string[] }[];
  /** 初始参数（长度/难度/时长等）；可选，默认 length+difficulty 两项 */
  paramDefaults?: ContextParam[];
  /** 用于生成保存标题：'水的三态变化' → '水的三态变化课件大纲' */
  saveTitleStem: string;
  initialMessages: { id: string; role: 'user' | 'assistant'; text: string }[];
}

const DEFAULT_PARAMS: ContextParam[] = [
  { key: 'length', label: '长度', value: '中等', options: ['简略', '中等', '详细'] },
  { key: 'difficulty', label: '难度', value: '常规', options: ['基础', '常规', '拓展'] },
];

/* 冷启动建议 · 每个 kind 一组一键开场词
   触发条件：messages.length <= 1（仅 greeting）+ 非流式
   点击 = 直接 sendMessage（不 fill input），用户可在 chat 里继续追问 */
interface PrepStarter {
  title: string;
  prompt: string;
}

const PREP_STARTERS: Record<PrepKind, PrepStarter[]> = {
  outline: [
    { title: '完整一节课大纲', prompt: '出一份完整一节课的 PPT 大纲，含 4-6 章节、目标、过渡' },
    { title: '8 分钟开场用', prompt: '只要 8 分钟开场用的简短大纲，含一个驱动问题' },
    { title: '围绕真实问题展开', prompt: '围绕一个学生身边的真实问题展开大纲' },
  ],
  lesson: [
    { title: '完整 40 分钟教案', prompt: '完整 40 分钟教学设计，含目标、重难点、流程、评价' },
    { title: '突破重难点 10 分钟', prompt: '只写 10 分钟的重难点突破环节，含追问设计' },
    { title: '导入 + 探究 15 分钟', prompt: '写课前导入 + 第一个探究环节（共 15 分钟）' },
  ],
  exercise: [
    { title: '5 题选择题', prompt: '出 5 题选择题，含标答和解析' },
    { title: '选 + 判 + 简答 8 题', prompt: '出 3 选择 + 3 判断 + 2 简答，含答案解析' },
    { title: '2 题综合应用', prompt: '出 2 道综合应用大题，分小问递进' },
    { title: '10 题基础填空', prompt: '出 10 题基础填空，含答案' },
  ],
  activity: [
    { title: '20 分钟动手实验', prompt: '设计 20 分钟动手实验，含材料、步骤、安全提示' },
    { title: '40 分钟探究活动', prompt: '设计 40 分钟探究活动，含分组、汇报、评价' },
    { title: '小组合作探究', prompt: '设计小组合作探究方案，4-6 人一组' },
  ],
  project: [
    { title: '6 课时项目', prompt: '设计 6 课时（约 3 周）项目化学习，含驱动问题、阶段、量规' },
    { title: '聚焦真实问题', prompt: '围绕一个生活中的真实问题展开 PBL 项目' },
    { title: '跨学科 4 课时', prompt: '4 课时跨学科融合项目，结合科学 + 信息科技' },
  ],
};

function PrepStarters({
  kind,
  onPick,
}: {
  kind: PrepKind;
  onPick: (text: string) => void;
}) {
  const items = PREP_STARTERS[kind];
  if (!items?.length) return null;
  return (
    <div
      className="mx-5 my-1 flex flex-col gap-2.5 border-t pt-4 pb-1"
      style={{ borderTopColor: 'var(--color-paper-rule)' }}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="font-numeric text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--color-ink-mute)' }}
        >
          quick start
        </span>
        <span className="text-[12.5px]" style={{ color: 'var(--color-ink-3)' }}>
          挑一个一键开始
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(s => (
          <button
            key={s.title}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="prep-starter-chip flex items-center gap-1.5 px-3 py-1.5 text-left transition-colors"
            style={{
              background: 'var(--color-paper-card)',
              border: '1px solid var(--color-paper-edge)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--color-ink-1)',
              fontSize: '12.5px',
              fontWeight: 500,
            }}
          >
            <span aria-hidden style={{ color: 'var(--color-ink-mute)' }}>▸</span>
            <span>{s.title}</span>
          </button>
        ))}
      </div>
      <style>{`
        .prep-starter-chip:hover {
          background: var(--color-paper-soft) !important;
          border-color: var(--color-paper-stamp) !important;
        }
      `}</style>
    </div>
  );
}

function toUIMessages(seeds: Props['initialMessages']): UIMessage[] {
  return seeds.map(s => ({
    id: s.id,
    role: s.role,
    parts: [{ type: 'text', text: s.text }],
  })) as UIMessage[];
}

interface ToolPart {
  type: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
}

interface ExaResultLike {
  url: string;
  title: string;
  snippet?: string;
  publishedDate?: string;
}

/**
 * artifact source 派生顺序：
 *   1. editedArtifact —— 用户在 drawer 编辑过；最高优先（不被 AI 覆盖）
 *   2. 最新一次 writeCanvas 工具的 input.markdown —— v2 流程主路径
 *   3. lastAssistantText（fallback）—— 兼容仍写在 chat 里的老对话
 */
function lastWriteCanvasMarkdown(messages: UIMessage[]): string {
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    const m = messages[mi];
    if (m.role !== 'assistant') continue;
    const parts = (m.parts ?? []) as ToolPart[];
    for (let pi = parts.length - 1; pi >= 0; pi--) {
      const p = parts[pi];
      if (p.type !== 'tool-writeCanvas') continue;
      // 接受 input-streaming 起 —— 一开始流式拼 markdown 就实时镜像到 canvas
      if (
        p.state !== 'input-streaming' &&
        p.state !== 'input-available' &&
        p.state !== 'output-available'
      ) continue;
      const inp = p.input as { markdown?: unknown } | undefined;
      if (typeof inp?.markdown === 'string' && inp.markdown.length > 0) {
        return inp.markdown;
      }
    }
  }
  return '';
}

function lastAssistantText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const text = (m.parts ?? [])
      .filter(p => p.type === 'text')
      .map(p => (p as { type: 'text'; text: string }).text)
      .join('');
    if (text) return text;
  }
  return '';
}

/**
 * 触发自动展开 drawer 的判断：
 * 看到 writeCanvas 或 editCanvas 的【任何】状态（含 input-streaming）就开 ——
 * 用户要看到 AI 一开始写就实时映出来，不用等 input 拼完。
 */
function hasAnyCanvasOp(messages: UIMessage[]): boolean {
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    for (const raw of m.parts ?? []) {
      const p = raw as ToolPart;
      if (p.type === 'tool-writeCanvas' || p.type === 'tool-editCanvas') return true;
    }
  }
  return false;
}

export interface PendingEdit {
  callId: string;
  find: string;
  replace: string;
  reason: string;
}

/** 抽出所有 input 已就绪的 editCanvas 调用 —— 候选 pending 改动 */
function extractEditCalls(messages: UIMessage[]): PendingEdit[] {
  const out: PendingEdit[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    for (const raw of m.parts ?? []) {
      const p = raw as ToolPart;
      if (p.type !== 'tool-editCanvas') continue;
      // 只在 input 拼完之后才暴露给 UI（streaming 时 find 可能不全）
      if (p.state !== 'input-available' && p.state !== 'output-available') continue;
      const callId = p.toolCallId;
      if (!callId) continue;
      const inp = p.input as
        | { find?: unknown; replace?: unknown; reason?: unknown }
        | undefined;
      if (typeof inp?.find !== 'string' || typeof inp.replace !== 'string') continue;
      if (!inp.find) continue;
      out.push({
        callId,
        find: inp.find,
        replace: inp.replace,
        reason: typeof inp.reason === 'string' ? inp.reason : '',
      });
    }
  }
  return out;
}

/** 把一条 edit 应用到 markdown：只替换第一处匹配；找不到时返回原文（标记 not-applied） */
function applyOneEdit(md: string, e: PendingEdit): { md: string; matched: boolean } {
  const idx = md.indexOf(e.find);
  if (idx < 0) return { md, matched: false };
  return {
    md: md.slice(0, idx) + e.replace + md.slice(idx + e.find.length),
    matched: true,
  };
}

/** 从 messages 里抽 webSearch / crawlUrl / findSimilar 的 output → 去重 Citation 列表 */
function extractCitations(messages: UIMessage[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const m of messages) {
    for (const raw of m.parts ?? []) {
      const p = raw as ToolPart;
      if (p.state !== 'output-available' || !p.output) continue;
      if (p.type === 'tool-webSearch' || p.type === 'tool-findSimilar') {
        const arr = p.output as ExaResultLike[];
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
        const r = p.output as ExaResultLike;
        if (r?.url && !seen.has(r.url)) {
          seen.set(r.url, { url: r.url, title: r.title });
        }
      }
    }
  }
  return [...seen.values()];
}

/** 从 messages 里抽工具调用的精简留痕 */
function extractToolTrace(messages: UIMessage[]): ToolTraceEntry[] {
  const trace: ToolTraceEntry[] = [];
  for (const m of messages) {
    for (const raw of m.parts ?? []) {
      const p = raw as ToolPart;
      if (!p.type.startsWith('tool-')) continue;
      if (p.state !== 'output-available' && p.state !== 'output-error') continue;
      trace.push({
        name: p.type.replace(/^tool-/, ''),
        input: p.input,
        ok: p.state === 'output-available',
        ts: new Date().toISOString(),
      });
    }
  }
  return trace;
}

// 哪些 kind 显示稿件侧栏（产物长 + 适合编辑） — 短产物（outline/activity）单栏即可
const KINDS_WITH_DRAWER: PrepKind[] = ['lesson', 'exercise', 'project', 'outline', 'activity'];
// ↑ v2: 全部 5 个 kind 都接 canvas —— 因为 writeCanvas 是流程必经；想隐就用户手动收

export function PrepToolPage({
  toolName,
  kind,
  contextFields: initialContextFields,
  paramDefaults = DEFAULT_PARAMS,
  saveTitleStem,
  initialMessages,
}: Props) {
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkedCourseId, setLinkedCourseId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Artifact drawer：默认收起；首次 writeCanvas / editCanvas 触发时自动展开（每个会话只一次）
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 用户在 drawer 编辑过的 markdown 源；非 null 时优先于 AI 输出
  const [editedArtifact, setEditedArtifact] = useState<string | null>(null);
  // Word 导出忙锁（topbar 按钮）
  const [exporting, setExporting] = useState(false);
  // 自动开过一次后置 true；用户主动关闭也算"已交互"，不再自动开
  const hasAutoOpenedRef = useRef(false);
  // editCanvas 的 Apply / 撤销 状态：appliedEditIds 是按点击顺序应用的列表（顺序敏感）
  const [appliedEditIds, setAppliedEditIds] = useState<string[]>([]);
  const [rejectedEditIds, setRejectedEditIds] = useState<Set<string>>(new Set());

  // 上下文 + 参数 state
  const [contextFields, setContextFields] = useState<ContextField[]>(initialContextFields);
  const [params, setParams] = useState<ContextParam[]>(paramDefaults);

  // ref 镜像：transport 闭包通过 ref 取最新 state，避免依赖变更后 transport 重建
  const stateRef = useRef({ contextFields, params });
  useEffect(() => {
    stateRef.current = { contextFields, params };
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/generate',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            kind,
            context: stateRef.current.contextFields.map(f => ({
              label: f.label,
              value: f.value,
            })),
            params: Object.fromEntries(
              stateRef.current.params.map(p => [p.key, p.value]),
            ),
          },
        }),
      }),
    [kind],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    messages: toUIMessages(initialMessages),
  });

  useEffect(() => {
    if (saved) setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const isStreaming = status === 'streaming' || status === 'submitted';

  // === artifact 派生（响应式） ===
  //
  //   base        = 最新 writeCanvas 的 markdown（fallback 为 last assistant text）
  //   applied     = 把 appliedEditIds 列表里的 editCanvas 调用按顺序应用到 base
  //   editedBy    = 用户在 drawer 自己又改过了 → 完全覆盖（最高优先）
  //
  // 这套派生让"应用 / 撤销"是纯前端的，不需要把改动同步回 chat history。
  // 全部包 useMemo：流式期间每个 chunk 都会让 messages 引用变；不过 baseCanvas
  // 这种字符串 === 一致的话，下游 ArtifactDrawer/MarkdownRenderer/MermaidBlock
  // 不会重新挂载。
  const baseCanvas = useMemo(() => {
    const fromTool = lastWriteCanvasMarkdown(messages);
    const fromText = lastAssistantText(messages);
    return fromTool || fromText;
  }, [messages]);

  const allEditCalls = useMemo(() => extractEditCalls(messages), [messages]);

  const editById = useMemo(() => {
    const m = new Map<string, PendingEdit>();
    for (const e of allEditCalls) m.set(e.callId, e);
    return m;
  }, [allEditCalls]);

  // 把已 Apply 的 edit 按点击顺序叠加应用到 baseCanvas
  const composedCanvas = useMemo(() => {
    let md = baseCanvas;
    for (const id of appliedEditIds) {
      const e = editById.get(id);
      if (!e) continue;
      md = applyOneEdit(md, e).md;
    }
    return md;
  }, [baseCanvas, appliedEditIds, editById]);

  const artifactSource = editedArtifact ?? composedCanvas;
  const showDrawerToggle = KINDS_WITH_DRAWER.includes(kind);
  const filename = `${saveTitleStem}${PREP_KIND_TITLE_SUFFIX[kind]}`;

  // 待审改动 = 还没 Apply 也没撤销的 editCanvas 调用
  const pendingEdits = useMemo(
    () =>
      allEditCalls.filter(
        e => !appliedEditIds.includes(e.callId) && !rejectedEditIds.has(e.callId),
      ),
    [allEditCalls, appliedEditIds, rejectedEditIds],
  );

  function handleApplyEdit(callId: string) {
    setAppliedEditIds(prev => (prev.includes(callId) ? prev : [...prev, callId]));
  }
  function handleRejectEdit(callId: string) {
    setRejectedEditIds(prev => {
      const next = new Set(prev);
      next.add(callId);
      return next;
    });
  }

  // 自动展开 drawer：搜完资料 → AI 调 writeCanvas / editCanvas → 立即打开 canvas
  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    if (!showDrawerToggle) return;
    if (drawerOpen) return;
    if (hasAnyCanvasOp(messages)) {
      setDrawerOpen(true);
      hasAutoOpenedRef.current = true;
    }
  }, [messages, showDrawerToggle, drawerOpen]);

  // 用户主动关闭 drawer 后不再自动开
  function handleDrawerClose() {
    setDrawerOpen(false);
    hasAutoOpenedRef.current = true;
  }
  function handleDrawerToggle() {
    setDrawerOpen(o => {
      const next = !o;
      if (!next) hasAutoOpenedRef.current = true;
      return next;
    });
  }

  // 聊天滚动：贴底跟随，用户上滚则不打扰
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    // 距离底部 < 60px 视为"贴底"
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  useEffect(() => {
    if (!stickRef.current) return;
    const el = chatScrollRef.current;
    if (!el) return;
    // 用 rAF 等到 layout 完成再滚到底
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  });

  async function handleSubmit(text: string) {
    // 主动发消息时强制贴底
    stickRef.current = true;
    await sendMessage({ text });
  }

  async function handleExportWord() {
    if (exporting || !artifactSource) return;
    setExporting(true);
    try {
      await exportMarkdownAsDocx(artifactSource, filename);
    } catch (e) {
      console.error('export docx failed', e);
      toast('导出失败：' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleSave() {
    // 保存的是"老师看到的稿件"——用户编辑过的 > writeCanvas 输入 > AI 原稿
    const content = artifactSource;
    if (!content) {
      toast('还没有内容可保存');
      return;
    }
    setSaving(true);
    try {
      const title = `${saveTitleStem}${PREP_KIND_TITLE_SUFFIX[kind]}`;
      const meta: Record<string, string> = {};
      contextFields.forEach(f => {
        meta[f.label] = f.value;
      });
      params.forEach(p => {
        meta[p.label] = p.value;
      });
      const citations = extractCitations(messages);
      const toolTrace = extractToolTrace(messages);
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'prep',
          kind,
          title,
          summary: content.replace(/\s+/g, ' ').slice(0, 60),
          agentName: toolName,
          avatar: title.charAt(0),
          meta,
          content,
          citations: citations.length ? citations : undefined,
          toolTrace: toolTrace.length ? toolTrace : undefined,
          linkedCourseId: linkedCourseId ?? undefined,
        }),
      });
      if (!res.ok) {
        toast('保存失败：服务暂不可用');
        return;
      }
      setSaved(true);
      toast(`已保存：${title}`);
    } catch (e) {
      console.error(e);
      toast('保存失败：网络错误');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Topbar
        crumb={toolName}
        showRecordsNav={false}
        right={
          <div className="flex items-center gap-3">
            <CoursePicker value={linkedCourseId} onChange={setLinkedCourseId} />
            {/* 5 个 kind 都有 Word 导出 */}
            <button
              onClick={handleExportWord}
              disabled={!artifactSource || exporting || isStreaming}
              className="font-display flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-medium disabled:opacity-50 transition-colors hover:[border-color:var(--color-paper-stamp)]"
              style={{
                background: 'var(--color-paper-card)',
                color: 'var(--color-ink-1)',
                border: '1px solid var(--color-paper-rule)',
                borderRadius: 'var(--radius-sm)',
              }}
              title="导出为 Word 文档"
            >
              <span aria-hidden>⬇</span>
              <span>{exporting ? '导出中…' : '导出 Word'}</span>
            </button>
            {showDrawerToggle && (
              <button
                onClick={handleDrawerToggle}
                disabled={!artifactSource}
                className="font-display flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-medium disabled:opacity-50 transition-colors"
                style={{
                  background: drawerOpen ? 'var(--color-paper-stamp)' : 'var(--color-paper-card)',
                  color: drawerOpen ? 'var(--color-paper-base)' : 'var(--color-ink-1)',
                  border: '1px solid var(--color-paper-rule)',
                  borderRadius: 'var(--radius-sm)',
                }}
                title={drawerOpen ? '收起稿件侧栏' : '打开稿件侧栏'}
              >
                <span aria-hidden>📄</span>
                <span>{drawerOpen ? '收稿件' : '稿件'}</span>
              </button>
            )}
            <SaveButton saved={saved} saving={saving} onSave={handleSave} />
          </div>
        }
      />
      <div
        className="mx-auto flex"
        style={{
          // 单栏：上限 1760，1280 屏以下收缩到 calc(100vw-120px) 不溢出。
          // drawer 开：上限 2080，drawer (720) + chat (≥1040) + 间距 共用。
          //   - 1920 屏：受 viewport 限到 1840，chat ≈ 1120, drawer 720
          //   - 2560 屏：到上限 2080，chat ≈ 1360, drawer 720
          maxWidth: drawerOpen
            ? 'min(2080px, calc(100vw - 80px))'
            : 'min(1760px, calc(100vw - 120px))',
          height: 'calc(100vh - var(--topbar-height))',
          transition: 'max-width 200ms ease',
        }}
      >
        <main className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden px-10 pt-8 pb-8">
          {/* 章节版口已移除：topbar crumb 已承担页面身份；省 ~80px 给 chat 工作区 */}
          <div className="mb-4 shrink-0 border-t pt-4" style={{ borderColor: 'var(--color-paper-rule)' }}>
            <ContextStrip
              fields={contextFields}
              params={params}
              editing={editing}
              onEdit={() => setEditing(true)}
              onEditDone={() => setEditing(false)}
              onFieldChange={(label, next) =>
                setContextFields(prev =>
                  prev.map(f => (f.label === label ? { ...f, value: next } : f)),
                )
              }
              onParamChange={(key, next) =>
                setParams(prev =>
                  prev.map(p => (p.key === key ? { ...p, value: next } : p)),
                )
              }
            />
          </div>

          {/* 对话/输出区 paper-card · 包 ChatArea + ChatInput */}
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden border"
            style={{
              background: 'var(--color-paper-card)',
              borderColor: 'var(--color-paper-edge)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <ChatArea messages={messages} isStreaming={isStreaming} />
              {/* 冷启动 chip · 首次进入空对话时引导一键开题；用户发首条后自动消失 */}
              {messages.length <= 1 && !isStreaming && (
                <PrepStarters kind={kind} onPick={handleSubmit} />
              )}
            </div>
            <div
              className="shrink-0 border-t"
              style={{ borderTopColor: 'var(--color-paper-rule)' }}
            >
              <ChatInput onSubmit={handleSubmit} disabled={isStreaming} />
            </div>
          </div>
        </main>
        {showDrawerToggle && drawerOpen && (
          <div className="shrink-0" style={{ width: 720 }}>
            <ArtifactDrawer
              open={drawerOpen}
              source={artifactSource}
              filename={filename}
              onSourceChange={setEditedArtifact}
              onClose={handleDrawerClose}
              pendingEdits={pendingEdits}
              onApplyEdit={handleApplyEdit}
              onRejectEdit={handleRejectEdit}
            />
          </div>
        )}
      </div>
    </>
  );
}
