'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from './Topbar';
import { useToast } from './Toast';
import type { SavedAgent } from '@/lib/agent-storage';
import {
  getDebateActor,
  getBackground,
  getTopicThumb,
  TOPIC_THUMBS,
  DEBATE_JUDGE_AVATAR,
} from '@/lib/asset-catalog';
import type { DebateAgentConfig } from '@/lib/agent-schemas';
import type { DebateTurnEntry } from '@/lib/types';

interface Props {
  agent: SavedAgent;
}

type Phase = 'idle' | 'ai-thinking' | 'human-input' | 'judging' | 'judged';

const JUDGE_TEMPLATES = {
  default: { label: '默认评委', desc: '平衡评议' },
  strict: { label: '严格评委', desc: '重论证逻辑' },
  encouraging: { label: '鼓励评委', desc: '强调亮点' },
  neutral: { label: '中性评委', desc: '客观陈述' },
} as const;

type MaterialKind = 'image' | 'video' | 'doc';

const MATERIAL_KIND: Record<string, MaterialKind> = {
  'biodegradation-experiment': 'video',
  'news-report': 'video',
  'policy-brief': 'doc',
  'school-recycling-case': 'doc',
};

const MATERIAL_VIDEO_META: Record<
  string,
  { duration: string; durationSec: number; transcript: { t: string; line: string }[] }
> = {
  'biodegradation-experiment': {
    duration: '04:18',
    durationSec: 258,
    transcript: [
      { t: '00:00', line: '实验目标：对比 PLA 与 PE 在堆肥环境下的降解差异。' },
      { t: '00:45', line: '日程安排：0 / 14 / 28 / 56 / 90 天观测点。' },
      { t: '02:12', line: '第 56 天：PLA 已碎裂、变薄；PE 几乎无可见变化。' },
      { t: '03:50', line: '结论：工业堆肥条件无法在自然海洋环境中复现。' },
    ],
  },
  'news-report': {
    duration: '03:42',
    durationSec: 222,
    transcript: [
      { t: '00:08', line: '近海塑料污染监测最新数据出炉。' },
      { t: '01:05', line: '专家：可降解塑料并非万能解。' },
      { t: '02:30', line: '上海一所小学的"塑料账本"实验。' },
      { t: '03:18', line: '记者结语：小小账本，大大改变。' },
    ],
  },
};

const MATERIAL_DOC_BODY: Record<
  string,
  { pages: number; sections: { heading: string; body: string }[] }
> = {
  'policy-brief': {
    pages: 4,
    sections: [
      {
        heading: '一、背景',
        body: '根据 2024 年《中国近海塑料垃圾监测报告》，我国近海塑料垃圾年均增长率为 4.7%。校园场景占城市生活塑料消耗的约 6%–9%，具有可量化、可干预、可作为科学课实验对象的特点。',
      },
      {
        heading: '二、推荐措施',
        body: '1. 校园层面：减少一次性外卖塑料餐具使用，提供可重复使用替代品。\n2. 课程层面：将"塑料污染与降解"主题纳入科学课实践模块。\n3. 数据层面：每学期采集一次班级塑料消耗量，作为辩论与项目式学习素材。',
      },
      {
        heading: '三、辩论引用要点',
        body: '· 不可降解塑料在自然环境下需 200+ 年完成分解。\n· "可降解" ≠ "在所有条件下都能降解"，标识需谨慎使用。\n· 政策禁用 ≠ 完全消失，需配合替代品供给与回收链路。',
      },
    ],
  },
  'school-recycling-case': {
    pages: 3,
    sections: [
      {
        heading: '基线测量（第 3–4 周）',
        body: '班级日均塑料消耗 2.3 kg。来源：课间饮料瓶 45%、文具包装 22%、外卖餐盒 18%、其他 15%。',
      },
      {
        heading: '干预阶段（第 5–12 周）',
        body: '引入"班级塑料账本"，每日由值日生记录，辅以家长签字。第 7 周追加"减塑积分换图书"机制。',
      },
      {
        heading: '关键发现',
        body: '1. 仅记录数据（无激励）阶段，塑料消耗下降 18%。\n2. 加入积分机制后，下降至基线 −41%。\n3. 寒假后第 13 周回访，反弹至基线 −12%。',
      },
      {
        heading: '对辩论的启示',
        body: '短期干预有效，长期行为改变需要结构性支持（供给链、家庭参与、激励机制）。',
      },
    ],
  },
};

function getMaterialKind(id: string): MaterialKind {
  return MATERIAL_KIND[id] ?? 'image';
}

/**
 * 辩论使用页 — 真 AI 辩论引擎 + 备课预演紧张感
 *
 * v0.2 升级（基于 plan ai-debate-arena-prep）:
 *   ① 气泡对话：流式发言/历史展示从单独区域 → 贴在 fighter 卡片下方做成对话气泡（带尾巴 + 入场动画）
 *   ② 紧张感系统：speaking 头像脉冲（0.8s 周期）+ VS 闪光呼吸 + 当前发言方那侧 arena 渐变高亮
 *   ③ 字段映射：评委卡片显示 judgeTemplate 徽章；论点行换为可 hover 展开的副标题；辩题条新增背景 hover
 *   ④ 调参抽屉：顶栏【⚙ 调参】滑出 380px 抽屉，就地改 totalRounds / judgeTemplate / proSide.argument / conSide.argument，立即/延后生效区分
 */
export function DebateUsePage({ agent }: Props) {
  const toast = useToast();
  const router = useRouter();

  const baseCfg = agent.config as Partial<DebateAgentConfig>;
  const name = baseCfg.name ?? '辩论智能体';
  const grade = baseCfg.grade ?? '一年级';
  const subject = baseCfg.subject ?? '科学';

  // 本地覆盖 state — 调参抽屉改的字段不写回原 agent，仅会话内生效
  const [overrideTopic, setOverrideTopic] = useState<string | null>(null);
  const [overrideRounds, setOverrideRounds] = useState<number | null>(null);
  const [overrideJudge, setOverrideJudge] = useState<DebateAgentConfig['judgeTemplate'] | null>(null);
  const [overrideProArg, setOverrideProArg] = useState<string | null>(null);
  const [overrideConArg, setOverrideConArg] = useState<string | null>(null);

  // 计算实际生效配置（override 优先）
  const topic = overrideTopic ?? baseCfg.topic ?? '（未指定辩题）';
  const totalRounds = overrideRounds ?? baseCfg.totalRounds ?? 3;
  const judgeTemplate = overrideJudge ?? baseCfg.judgeTemplate ?? 'default';
  const proArgument = overrideProArg ?? baseCfg.proSide?.argument ?? '';
  const conArgument = overrideConArg ?? baseCfg.conSide?.argument ?? '';
  const totalTurns = totalRounds * 2;

  const proActor = getDebateActor(baseCfg.proSide?.actorId);
  const conActor = getDebateActor(baseCfg.conSide?.actorId);
  const bg = getBackground('debate', baseCfg.bgAsset);
  const thumb = getTopicThumb(baseCfg.thumbAsset);

  const [currentTurn, setCurrentTurn] = useState(0);
  const [history, setHistory] = useState<DebateTurnEntry[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [aiPartial, setAiPartial] = useState('');
  const [humanInput, setHumanInput] = useState('');
  const [judgeText, setJudgeText] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [judgeOpen, setJudgeOpen] = useState(false);
  const speechPopupRef = useRef<HTMLDivElement>(null);

  // 流式发言时弹窗内容自动贴底，新文字总在视口
  useEffect(() => {
    if (phase === 'ai-thinking' && speechPopupRef.current) {
      speechPopupRef.current.scrollTop = speechPopupRef.current.scrollHeight;
    }
  }, [aiPartial, phase]);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materialsZoomId, setMaterialsZoomId] = useState<string | null>(null);

  // 调参抽屉是否有未提交修改
  const dirty = useMemo(
    () =>
      overrideTopic !== null ||
      overrideRounds !== null ||
      overrideJudge !== null ||
      overrideProArg !== null ||
      overrideConArg !== null,
    [overrideTopic, overrideRounds, overrideJudge, overrideProArg, overrideConArg],
  );

  const isAllTurnsDone = currentTurn >= totalTurns;
  const currentSide: 'pro' | 'con' = currentTurn % 2 === 0 ? 'pro' : 'con';
  const currentRound = Math.floor(currentTurn / 2) + 1;
  const baseProSide = baseCfg.proSide;
  const baseConSide = baseCfg.conSide;
  const currentSideKind =
    (currentSide === 'pro' ? baseProSide?.type : baseConSide?.type) ?? 'ai';

  // 把 override 喂回 fetch payload —— 让 AI 按修改后论点发言
  const effectiveAgent = useMemo(() => {
    if (!dirty) return agent;
    const patched = JSON.parse(JSON.stringify(agent)) as SavedAgent;
    const cfg = patched.config as Partial<DebateAgentConfig>;
    if (overrideTopic !== null) cfg.topic = overrideTopic;
    if (overrideRounds !== null) cfg.totalRounds = overrideRounds as DebateAgentConfig['totalRounds'];
    if (overrideJudge !== null) cfg.judgeTemplate = overrideJudge;
    if (overrideProArg !== null && cfg.proSide) cfg.proSide.argument = overrideProArg;
    if (overrideConArg !== null && cfg.conSide) cfg.conSide.argument = overrideConArg;
    return patched;
  }, [agent, dirty, overrideTopic, overrideRounds, overrideJudge, overrideProArg, overrideConArg]);

  /** fetch 流式响应 + 累加 chunk */
  async function streamFetch(
    url: string,
    body: unknown,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      onChunk(chunk);
    }
    return full;
  }

  /** 推进当前 turn */
  async function advanceTurn() {
    if (isAllTurnsDone || phase !== 'idle') return;
    if (currentSideKind === 'ai') {
      setPhase('ai-thinking');
      setAiPartial('');
      try {
        const full = await streamFetch(
          '/api/debate-turn',
          { agent: effectiveAgent, side: currentSide, history, currentRound },
          chunk => setAiPartial(prev => prev + chunk),
        );
        setHistory(prev => [
          ...prev,
          { round: currentRound, side: currentSide, text: full.trim() },
        ]);
        setCurrentTurn(t => t + 1);
        setAiPartial('');
        setPhase('idle');
      } catch (e) {
        console.error(e);
        toast('AI 发言失败，请重试');
        setPhase('idle');
        setAiPartial('');
      }
    } else {
      setPhase('human-input');
      setHumanInput('');
    }
  }

  function submitHuman() {
    const text = humanInput.trim();
    if (!text) {
      toast('请输入发言内容');
      return;
    }
    setHistory(prev => [...prev, { round: currentRound, side: currentSide, text }]);
    setCurrentTurn(t => t + 1);
    setHumanInput('');
    setPhase('idle');
  }

  async function summonJudge() {
    if (history.length === 0) {
      toast('还没有发言可供评审');
      return;
    }
    setPhase('judging');
    setJudgeText('');
    setScore(null);
    setJudgeOpen(true);
    try {
      const full = await streamFetch(
        '/api/debate-judge',
        { agent: effectiveAgent, history },
        chunk => setJudgeText(prev => prev + chunk),
      );
      const m = full.match(/<score>([\d.]+)<\/score>/);
      if (m && m[1]) setScore(parseFloat(m[1]));
      setPhase('judged');
    } catch (e) {
      console.error(e);
      toast('评委召唤失败，请重试');
      setPhase('idle');
    }
  }

  async function endAndSave() {
    if (history.length === 0) {
      toast('还没有发言可保存');
      return;
    }
    if (phase !== 'judged') {
      toast('请先召唤评委生成点评');
      return;
    }
    setSaving(true);
    try {
      const proCount = history.filter(h => h.side === 'pro').length;
      const conCount = history.filter(h => h.side === 'con').length;
      const cleanJudge = judgeText.replace(/<score>[\d.]+<\/score>/g, '').trim();
      const summary =
        score !== null
          ? `正方 ${proCount} 段 · 反方 ${conCount} 段 · AI 评委综合评分 ${score.toFixed(1)}`
          : `正方 ${proCount} 段 · 反方 ${conCount} 段 · AI 评委已点评`;
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'debate',
          title: topic,
          summary,
          agentName: name,
          avatar: '辩',
          avatarUrl: DEBATE_JUDGE_AVATAR,
          pro: proCount,
          con: conCount,
          score: score ?? undefined,
          transcript: { history, judgeText: cleanJudge, ...(score !== null ? { score } : {}) },
          meta: {
            agentId: agent.id,
            judgeText: cleanJudge.slice(0, 600),
            grade,
            subject,
            proActorId: baseCfg.proSide?.actorId,
            conActorId: baseCfg.conSide?.actorId,
            thumbAsset: baseCfg.thumbAsset,
            bgAsset: baseCfg.bgAsset,
            totalRounds: String(totalRounds),
            judgeTemplate,
          },
        }),
      });
      if (!res.ok) {
        toast('保存失败：服务暂不可用');
        return;
      }
      toast('已保存辩论到我的记录');
      setTimeout(() => router.push('/records'), 700);
    } catch (e) {
      console.error(e);
      toast('保存失败：网络错误');
    } finally {
      setSaving(false);
    }
  }

  // 当前直播状态（流式 partial 或人输入），用于在 fighter 下方做气泡
  const proSpeaking =
    (phase === 'ai-thinking' || phase === 'human-input') && currentSide === 'pro';
  const conSpeaking =
    (phase === 'ai-thinking' || phase === 'human-input') && currentSide === 'con';

  // 取每方最新一条历史，作为非直播时的 fighter 气泡内容
  const lastProTurn = [...history].reverse().find(h => h.side === 'pro');
  const lastConTurn = [...history].reverse().find(h => h.side === 'con');

  const judgeMeta = JUDGE_TEMPLATES[judgeTemplate];

  function resetOverrides() {
    setOverrideTopic(null);
    setOverrideRounds(null);
    setOverrideJudge(null);
    setOverrideProArg(null);
    setOverrideConArg(null);
  }

  return (
    <>
      {/* ═══ v0.2 紧张感样式（局部 keyframes，不污染全局） ═══ */}
      <style jsx>{`
        @keyframes debatePulse {
          0%, 100% {
            box-shadow: 0 0 0 4px oklch(0.575 0.200 25 / 0.10);
          }
          50% {
            box-shadow: 0 0 0 12px oklch(0.575 0.200 25 / 0.22);
          }
        }
        @keyframes debatePulsePrimary {
          0%, 100% {
            box-shadow: 0 0 0 4px oklch(0.620 0.180 250 / 0.10);
          }
          50% {
            box-shadow: 0 0 0 12px oklch(0.620 0.180 250 / 0.22);
          }
        }
        @keyframes vsCharge {
          0%, 100% {
            box-shadow: 0 0 0 0 oklch(0.575 0.200 25 / 0);
          }
          50% {
            box-shadow: 0 0 18px 4px oklch(0.575 0.200 25 / 0.45);
          }
        }
        @keyframes bubbleSlideIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes bubbleNudge {
          0%, 90%, 100% {
            transform: translateX(0);
          }
          93% {
            transform: translateX(-2px);
          }
          96% {
            transform: translateX(2px);
          }
        }
        @keyframes caretBlink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
        @keyframes speechPopIn {
          0% {
            transform: translate(-50%, -10px) scale(0.97);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
          }
        }
        @keyframes speakingDots {
          0%, 20% { opacity: 0.3; }
          50% { opacity: 1; }
          80%, 100% { opacity: 0.3; }
        }
        :global(.speech-popup) {
          animation: speechPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }
        :global(.speech-popup .dot) {
          display: inline-block;
          animation: speakingDots 1.2s ease-in-out infinite;
        }
        :global(.speech-popup .dot:nth-child(2)) { animation-delay: 0.18s; }
        :global(.speech-popup .dot:nth-child(3)) { animation-delay: 0.36s; }
        :global(.pulse-ring-pro) {
          animation: debatePulsePrimary 0.8s ease-in-out infinite;
        }
        :global(.pulse-ring-con) {
          animation: debatePulse 0.8s ease-in-out infinite;
        }
        :global(.vs-charge) {
          animation: vsCharge 2s ease-in-out infinite;
          transition: transform 0.4s ease-in-out;
        }
        :global(.vs-charge.switching) {
          transform: rotate(180deg);
        }
        :global(.speech-bubble) {
          position: relative;
          animation: bubbleSlideIn 0.35s ease-out;
        }
        :global(.speech-bubble.live) {
          animation: bubbleSlideIn 0.35s ease-out, bubbleNudge 2.5s ease-in-out infinite 0.5s;
        }
        :global(.speech-bubble::before) {
          content: '';
          position: absolute;
          top: -7px;
          width: 0;
          height: 0;
          border: 7px solid transparent;
        }
        :global(.speech-bubble.bubble-pro::before) {
          left: 28px;
          border-bottom-color: var(--bubble-bg);
        }
        :global(.speech-bubble.bubble-con::before) {
          right: 28px;
          border-bottom-color: var(--bubble-bg);
        }
        :global(.typing-caret::after) {
          content: '▍';
          margin-left: 2px;
          animation: caretBlink 0.9s ease-in-out infinite;
          color: var(--color-debate);
        }
        :global(.arena-side-glow) {
          position: relative;
        }
        :global(.arena-side-glow::before) {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0;
          transition: opacity 0.3s, background 0.3s;
          border-radius: inherit;
        }
        :global(.arena-side-glow.pro-glow::before) {
          opacity: 0.55;
          background: linear-gradient(90deg, var(--color-primary-bg) 0%, transparent 55%);
        }
        :global(.arena-side-glow.con-glow::before) {
          opacity: 0.55;
          background: linear-gradient(270deg, var(--color-debate-bg) 0%, transparent 55%);
        }
        :global(.arena-side-glow > *) {
          position: relative;
          z-index: 1;
        }
      `}</style>

      <Topbar
        crumb={name}
        showRecordsNav={false}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMaterialsOpen(true)}
              className="h-8 rounded-md border px-3 text-[13px] transition-colors hover:border-[var(--color-debate)] hover:text-[var(--color-debate)]"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-2)',
                background: 'var(--color-bg-card)',
              }}
              title="查看辩论资料 · 投影给学生"
            >
              📚 资料
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="h-8 rounded-md border px-3 text-[13px] transition-colors"
              style={{
                borderColor: dirty ? 'var(--color-prep)' : 'var(--color-border)',
                color: dirty ? 'var(--color-prep)' : 'var(--color-text-2)',
                background: dirty ? 'var(--color-prep-bg)' : 'var(--color-bg-card)',
              }}
              title="备课调参（不影响原配置）"
            >
              ⚙ 调参{dirty ? ' ·' : ''}
            </button>
            <button
              onClick={endAndSave}
              disabled={saving || phase !== 'judged'}
              className="h-8 rounded-md px-4 text-[13px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'var(--color-success)' }}
              title={phase !== 'judged' ? '请先召唤评委生成点评' : ''}
            >
              {saving ? '保存中…' : '保存到记录'}
            </button>
          </div>
        }
      />

      <main
        className="relative mx-auto w-full px-6 py-6 pb-12"
        style={{ maxWidth: 'var(--container-wide)' }}
      >
        {/* 背景水印 */}
        {bg && (
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ opacity: 0.05 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bg.src} alt="" className="h-full w-full object-cover" aria-hidden />
          </div>
        )}

        {/* 辩题条 */}
        <div
          className="mb-4 flex items-center gap-4 rounded-xl border bg-white p-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {thumb && (
            <div className="shrink-0 overflow-hidden rounded-md" style={{ width: 96, height: 54 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb.src} alt={thumb.label} width={640} height={360} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
              <span style={{ color: 'var(--color-debate)' }}>辩题</span> · {topic}
              {overrideTopic !== null && (
                <span
                  className="ml-2 rounded-sm px-1.5 py-0.5 text-[10px] font-normal"
                  style={{ background: 'var(--color-prep-bg)', color: 'var(--color-prep)' }}
                  title="本场临时修改（未回写智能体）"
                >
                  本场临改
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-4)' }}>
              <span>{subject}</span><span>·</span>
              <span>{grade}</span><span>·</span>
              <span>共 {totalRounds} 轮</span>
              {baseCfg.background && (
                <>
                  <span>·</span>
                  <span
                    className="cursor-help underline decoration-dotted underline-offset-2"
                    title={baseCfg.background}
                  >
                    辩题背景
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalRounds }).map((_, i) => {
              const completedRounds = Math.floor(currentTurn / 2);
              const status =
                i < completedRounds ? 'done' : i === completedRounds && !isAllTurnsDone ? 'now' : 'pending';
              return (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: status === 'pending' ? 'var(--color-border)' : 'var(--color-debate)',
                    boxShadow: status === 'now' ? '0 0 0 3px var(--color-debate-bg)' : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* 擂台 */}
        <div
          className={`arena-side-glow mb-4 grid items-start gap-6 rounded-xl border bg-white p-6 ${
            proSpeaking ? 'pro-glow' : conSpeaking ? 'con-glow' : ''
          }`}
          style={{ borderColor: 'var(--color-border)', gridTemplateColumns: '1fr 120px 1fr' }}
        >
          <Fighter
            sideLabel="正方"
            kindLabel={baseProSide?.type === 'human' ? '学生' : 'AI'}
            roleUrl={proActor?.role}
            argument={proArgument}
            argumentEdited={overrideProArg !== null}
            color="var(--color-primary)"
            colorBg="var(--color-primary-bg)"
            colorEdge="var(--color-primary-border)"
            speaking={proSpeaking}
            bubbleSide="pro"
            bubble={
              proSpeaking && phase === 'human-input'
                ? { text: '正在等你输入…', kind: 'live-input' }
                : lastProTurn
                ? { text: lastProTurn.text, kind: 'history' }
                : null
            }
          />

          <div className="flex items-center justify-center pt-32">
            <div
              className={`vs-charge flex h-20 w-20 items-center justify-center rounded-full text-[18px] font-bold ${
                phase === 'ai-thinking' ? 'switching' : ''
              }`}
              style={{
                border: '3px dashed var(--color-debate)',
                color: 'var(--color-debate)',
                background: 'var(--color-bg-card)',
              }}
              title="对抗中"
            >
              VS
            </div>
          </div>

          <Fighter
            sideLabel="反方"
            kindLabel={baseConSide?.type === 'human' ? '学生' : 'AI'}
            roleUrl={conActor?.role}
            argument={conArgument}
            argumentEdited={overrideConArg !== null}
            color="var(--color-debate)"
            colorBg="var(--color-debate-bg)"
            colorEdge="var(--color-debate-soft)"
            speaking={conSpeaking}
            bubbleSide="con"
            bubble={
              conSpeaking && phase === 'human-input'
                ? { text: '正在等你输入…', kind: 'live-input' }
                : lastConTurn
                ? { text: lastConTurn.text, kind: 'history' }
                : null
            }
          />
        </div>

        {/* 当前回合控制（精简：仅做"动作触发"，发言展示已下放到 fighter 气泡） */}
        <div className="mb-4">
          {!isAllTurnsDone && phase === 'idle' && (
            <div
              className="rounded-xl border bg-white p-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-[13px]" style={{ color: 'var(--color-text-3)' }}>
                    {history.length === 0 ? '准备开始' : '上一轮完成'} · 即将进入第 {currentRound} 轮 ·
                    <span
                      className="ml-1 font-semibold"
                      style={{ color: currentSide === 'pro' ? 'var(--color-primary)' : 'var(--color-debate)' }}
                    >
                      {currentSide === 'pro' ? '正方' : '反方'}
                    </span>
                    （{currentSideKind === 'ai' ? 'AI 自动发言' : '需要人类输入'}）
                  </div>
                </div>
                <button
                  onClick={advanceTurn}
                  className="rounded-md px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
                  style={{ background: 'var(--color-debate)' }}
                >
                  {currentSideKind === 'ai' ? '让 AI 开始发言' : '由我代为发言'}
                </button>
              </div>
            </div>
          )}

          {phase === 'human-input' && (
            <div
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="mb-2 text-[12px]" style={{ color: 'var(--color-text-4)' }}>
                第 {currentRound} 轮 · {currentSide === 'pro' ? '正方' : '反方'} · 请输入发言（可代学生输入）
              </div>
              <textarea
                value={humanInput}
                onChange={e => setHumanInput(e.target.value)}
                rows={4}
                className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-[var(--color-primary)]"
                style={{ borderColor: 'var(--color-border-input)' }}
                placeholder="一段话写明立场和主要论据，80-150 字"
              />
              <button
                onClick={submitHuman}
                className="mt-2 rounded-md px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: 'var(--color-debate)' }}
              >
                提交发言
              </button>
            </div>
          )}

          {isAllTurnsDone && phase === 'idle' && !judgeText && (
            <div
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="mb-2 text-[13px]" style={{ color: 'var(--color-text-3)' }}>
                {totalRounds} 轮辩论已完成。可以请 AI 评委点评了。
              </div>
              <button
                onClick={summonJudge}
                className="rounded-md px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: 'var(--color-prep)' }}
              >
                🎓 召唤 AI 评委
              </button>
            </div>
          )}

          {phase === 'judged' && !judgeOpen && (
            <div
              className="flex items-center justify-between rounded-xl border bg-white p-4"
              style={{ borderColor: 'var(--color-warn-border)', background: 'var(--color-warn-bg)' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 overflow-hidden rounded-full" style={{ background: 'var(--color-prep-bg)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={DEBATE_JUDGE_AVATAR} alt="评委" width={512} height={512} className="h-full w-full object-cover" />
                </div>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--color-prep)' }}>
                  AI 评委已点评
                </span>
                {score !== null && (
                  <span className="tnum text-[15px] font-bold" style={{ color: 'var(--color-prep)' }}>
                    {score.toFixed(1)}<span className="text-[11px] font-normal opacity-70"> / 10</span>
                  </span>
                )}
              </div>
              <button
                onClick={() => setJudgeOpen(true)}
                className="rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-white"
                style={{ borderColor: 'var(--color-warn-border)', color: 'var(--color-prep)' }}
              >
                查看点评 →
              </button>
            </div>
          )}
        </div>

        {/* 历史 */}
        {history.length > 0 && (
          <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--color-border)' }}>
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-4)' }}>
              辩论实录（{history.length} 段发言）
            </div>
            <div className="flex flex-col gap-3">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex gap-2.5 border-b pb-3 last:border-b-0 last:pb-0"
                  style={{ borderColor: 'var(--color-border-soft)' }}
                >
                  <div
                    className="flex h-7 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold"
                    style={{
                      background: h.side === 'pro' ? 'var(--color-primary-bg)' : 'var(--color-debate-bg)',
                      color: h.side === 'pro' ? 'var(--color-primary)' : 'var(--color-debate)',
                    }}
                  >
                    第 {h.round} 轮 · {h.side === 'pro' ? '正方' : '反方'}
                  </div>
                  <div className="flex-1 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    {h.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ═══ AI 发言弹窗（流式播放）═══ */}
      {phase === 'ai-thinking' && (
        <div
          className="speech-popup pointer-events-none fixed left-1/2 top-[96px] z-[80] w-full max-w-[680px] px-6"
          style={{
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="pointer-events-auto rounded-2xl border-2 bg-white p-5"
            style={{
              borderColor: currentSide === 'pro' ? 'var(--color-primary)' : 'var(--color-debate)',
              boxShadow:
                currentSide === 'pro'
                  ? '0 24px 60px -16px oklch(0.620 0.180 250 / 0.32), 0 4px 14px -4px oklch(0.620 0.180 250 / 0.18)'
                  : '0 24px 60px -16px oklch(0.575 0.200 25 / 0.32), 0 4px 14px -4px oklch(0.575 0.200 25 / 0.18)',
            }}
          >
            <header className="mb-3 flex items-center gap-2.5">
              <div
                className={`h-9 w-9 overflow-hidden rounded-full border-2 ${
                  currentSide === 'pro' ? 'pulse-ring-pro' : 'pulse-ring-con'
                }`}
                style={{
                  borderColor: currentSide === 'pro' ? 'var(--color-primary)' : 'var(--color-debate)',
                  background: currentSide === 'pro' ? 'var(--color-primary-bg)' : 'var(--color-debate-bg)',
                }}
              >
                {(currentSide === 'pro' ? proActor?.role : conActor?.role) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={(currentSide === 'pro' ? proActor : conActor)?.role}
                    alt=""
                    width={1024}
                    height={1536}
                    className="h-full w-full object-cover object-top"
                  />
                )}
              </div>
              <span
                className="rounded-full px-3 py-0.5 text-[12px] font-semibold"
                style={{
                  background: currentSide === 'pro' ? 'var(--color-primary-bg)' : 'var(--color-debate-bg)',
                  color: currentSide === 'pro' ? 'var(--color-primary)' : 'var(--color-debate)',
                }}
              >
                {currentSide === 'pro' ? '正方' : '反方'} · 第 {currentRound} 轮
              </span>
              <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                AI 发言中
                <span aria-hidden>
                  <span className="dot">·</span>
                  <span className="dot">·</span>
                  <span className="dot">·</span>
                </span>
              </span>
            </header>
            <div
              ref={speechPopupRef}
              className="max-h-[44vh] min-h-[40px] overflow-y-auto whitespace-pre-wrap text-[15px] leading-[1.7]"
              style={{ color: 'var(--color-text)' }}
            >
              {aiPartial ? (
                <>
                  {aiPartial}
                  <span className="typing-caret" />
                </>
              ) : (
                <span style={{ color: 'var(--color-text-4)', fontStyle: 'italic' }}>
                  正在组织语言<span className="typing-caret" />
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ AI 评委弹窗 ═══ */}
      {judgeOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center px-6"
          style={{ background: 'oklch(0.20 0.01 80 / 0.45)' }}
          onClick={() => phase === 'judged' && setJudgeOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border shadow-2xl"
            style={{
              borderColor: 'var(--color-warn-border)',
              background: 'var(--color-warn-bg)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <header
              className="flex shrink-0 items-center gap-3 border-b px-5 py-4"
              style={{ borderColor: 'var(--color-warn-border)' }}
            >
              <div className="h-10 w-10 overflow-hidden rounded-full" style={{ background: 'var(--color-prep-bg)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={DEBATE_JUDGE_AVATAR} alt="评委" width={512} height={512} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold" style={{ color: 'var(--color-prep)' }}>
                    AI 评委 {phase === 'judging' ? '· 点评中…' : '· 点评完成'}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: 'var(--color-prep-bg)',
                      color: 'var(--color-prep)',
                      border: '1px solid var(--color-warn-border)',
                    }}
                    title="评委模板（来自创建页 judgeTemplate；可在调参抽屉就地切换）"
                  >
                    {judgeMeta.label} · {judgeMeta.desc}
                  </span>
                  {overrideJudge !== null && (
                    <span
                      className="rounded-sm px-1.5 py-0.5 text-[10px]"
                      style={{ background: 'var(--color-prep-bg)', color: 'var(--color-prep)' }}
                    >
                      本场临改
                    </span>
                  )}
                </div>
              </div>
              {score !== null && (
                <div className="flex items-baseline gap-1">
                  <span className="tnum text-[28px] font-bold" style={{ color: 'var(--color-prep)' }}>
                    {score.toFixed(1)}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--color-text-4)' }}>/ 10</span>
                </div>
              )}
              <button
                onClick={() => setJudgeOpen(false)}
                disabled={phase === 'judging'}
                className="ml-2 h-8 w-8 rounded-md border text-[18px] leading-none transition-colors enabled:hover:border-[var(--color-debate)] enabled:hover:text-[var(--color-debate)] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: 'var(--color-warn-border)', color: 'var(--color-text-4)' }}
                aria-label={phase === 'judging' ? '点评中无法关闭' : '关闭'}
                title={phase === 'judging' ? '点评进行中' : '关闭'}
              >
                ×
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: 'var(--color-text)' }}>
                {judgeText.replace(/<score>[\d.]+<\/score>/g, '').trim() || '…'}
                {phase === 'judging' && <span className="typing-caret" />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ v0.2 调参抽屉 ═══ */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[105]"
          style={{ background: 'oklch(0.20 0.01 80 / 0.30)' }}
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside
        className="fixed top-0 z-[110] flex h-screen flex-col border-l bg-white shadow-2xl transition-[right] duration-200 ease-out"
        style={{
          right: drawerOpen ? 0 : -400,
          width: 380,
          borderColor: 'var(--color-border)',
        }}
        aria-hidden={!drawerOpen}
      >
        <header
          className="flex shrink-0 items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-soft)' }}
        >
          <div>
            <strong className="text-[15px]" style={{ color: 'var(--color-text)' }}>备课调参</strong>
            <span className="ml-1.5 text-[11px]" style={{ color: 'var(--color-text-4)' }}>把课备扎实再上课</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="h-7 w-7 rounded-md border text-[18px] leading-none transition-colors hover:border-[var(--color-debate)] hover:text-[var(--color-debate)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-4)' }}
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 备课检查清单 */}
          <section
            className="mb-5 rounded-md border p-3"
            style={{ borderColor: 'var(--color-border-soft)', background: 'var(--color-bg-soft)' }}
          >
            <div className="mb-2 text-[12px] font-semibold" style={{ color: 'var(--color-text-3)' }}>
              备课检查清单
            </div>
            <ul className="space-y-1 text-[12px]">
              <li style={{ color: proArgument ? 'var(--color-primary)' : 'var(--color-debate)' }}>
                {proArgument ? '☑' : '☐'} 正方论点 {proArgument ? `（${proArgument.length} 字）` : '未配置'}
              </li>
              <li style={{ color: conArgument ? 'var(--color-primary)' : 'var(--color-debate)' }}>
                {conArgument ? '☑' : '☐'} 反方论点 {conArgument ? `（${conArgument.length} 字）` : '未配置'}
              </li>
              <li style={{ color: 'var(--color-primary)' }}>
                ☑ 评委模板（{judgeMeta.label}）
              </li>
              <li style={{ color: 'var(--color-primary)' }}>
                ☑ 共 {totalRounds} 轮 · 适合 {grade}
              </li>
            </ul>
          </section>

          {/* 实时调整 */}
          <section className="mb-5">
            <div className="mb-2 text-[12px] font-semibold" style={{ color: 'var(--color-text-3)' }}>
              实时调整
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--color-text-2)' }}>
                辩题
              </label>
              <input
                type="text"
                value={overrideTopic ?? topic}
                onChange={e => setOverrideTopic(e.target.value)}
                className="w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-primary)]"
                style={{ borderColor: 'var(--color-border-input)' }}
              />
              <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-5)' }}>
                ❄️ 仅显示生效，不改写已有发言历史
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--color-text-2)' }}>
                  辩论轮数
                </label>
                <select
                  value={overrideRounds ?? totalRounds}
                  onChange={e => {
                    const newRounds = parseInt(e.target.value, 10);
                    if (newRounds < currentRound) {
                      const ok = confirm(`新轮数 ${newRounds} < 当前进度（第 ${currentRound} 轮），将忽略本次修改。`);
                      if (!ok) return;
                      return;
                    }
                    setOverrideRounds(newRounds);
                  }}
                  className="w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-primary)]"
                  style={{ borderColor: 'var(--color-border-input)' }}
                >
                  <option value={2}>2 轮</option>
                  <option value={3}>3 轮</option>
                  <option value={4}>4 轮</option>
                  <option value={5}>5 轮</option>
                </select>
                <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-5)' }}>
                  🔥 立即生效（不少于当前轮）
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--color-text-2)' }}>
                  评委模板
                </label>
                <select
                  value={overrideJudge ?? judgeTemplate}
                  onChange={e => setOverrideJudge(e.target.value as DebateAgentConfig['judgeTemplate'])}
                  className="w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-primary)]"
                  style={{ borderColor: 'var(--color-border-input)' }}
                >
                  <option value="default">默认评委</option>
                  <option value="strict">严格 · 重论证逻辑</option>
                  <option value="encouraging">鼓励 · 强调亮点</option>
                  <option value="neutral">中性 · 客观陈述</option>
                </select>
                <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-5)' }}>
                  🔥 立即生效（徽章 + 下次点评）
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--color-text-2)' }}>
                正方论点
              </label>
              <textarea
                value={overrideProArg ?? proArgument}
                onChange={e => setOverrideProArg(e.target.value)}
                rows={3}
                className="w-full rounded-md border px-2.5 py-1.5 text-[13px] leading-relaxed outline-none focus:border-[var(--color-primary)]"
                style={{ borderColor: 'var(--color-border-input)' }}
              />
              <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-5)' }}>
                ❄️ 下次正方 AI 发言时按新论点驱动（已发言历史保留）
              </div>
            </div>

            <div className="mb-2">
              <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--color-text-2)' }}>
                反方论点
              </label>
              <textarea
                value={overrideConArg ?? conArgument}
                onChange={e => setOverrideConArg(e.target.value)}
                rows={3}
                className="w-full rounded-md border px-2.5 py-1.5 text-[13px] leading-relaxed outline-none focus:border-[var(--color-primary)]"
                style={{ borderColor: 'var(--color-border-input)' }}
              />
              <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-5)' }}>
                ❄️ 下次反方 AI 发言时按新论点驱动
              </div>
            </div>
          </section>

          <section
            className="rounded-md border-2 border-dashed px-3 py-2.5 text-[11px] leading-relaxed"
            style={{
              borderColor: 'var(--color-warn-border)',
              background: 'var(--color-warn-bg)',
              color: 'var(--color-warn)',
            }}
          >
            🔥 <strong>立即生效</strong>：轮数 / 评委模板（修改后立刻反映到主页面）
            <br />
            ❄️ <strong>下次发言/点评生效</strong>：辩题 / 论点（不动已有历史）
          </section>
        </div>

        <footer
          className="flex shrink-0 gap-2 border-t px-5 py-3"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-soft)' }}
        >
          <button
            onClick={() => {
              resetOverrides();
              toast('已恢复智能体原配置');
              setDrawerOpen(false);
            }}
            disabled={!dirty}
            className="flex-1 rounded-md border px-3 py-2 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
          >
            恢复原配置
          </button>
          <button
            onClick={() => {
              toast(dirty ? '已应用到本场预演（原配置未变）' : '没有修改');
              setDrawerOpen(false);
            }}
            className="flex-1 rounded-md px-3 py-2 text-[12px] font-medium text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--color-debate)' }}
          >
            应用本场（不回写）
          </button>
        </footer>
      </aside>

      {/* ═══ 资料弹窗（备课用 · 不影响 AI 上下文） ═══ */}
      {materialsOpen && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center px-6"
          style={{ background: 'oklch(0.20 0.01 80 / 0.45)' }}
          onClick={() => {
            if (materialsZoomId) setMaterialsZoomId(null);
            else setMaterialsOpen(false);
          }}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-[920px] flex-col overflow-hidden rounded-xl border bg-white shadow-2xl"
            style={{ borderColor: 'var(--color-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <header
              className="flex shrink-0 items-center gap-3 border-b px-5 py-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span className="text-[18px]">📚</span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>
                  辩论资料 · 备课参考
                </div>
                <div className="text-[12px]" style={{ color: 'var(--color-text-4)' }}>
                  {topic} · 共 {TOPIC_THUMBS.length} 份资料 · 仅展示用，不写入 AI 上下文
                </div>
              </div>
              <button
                onClick={() => setMaterialsOpen(false)}
                className="ml-2 h-8 w-8 rounded-md border text-[18px] leading-none transition-colors hover:border-[var(--color-debate)] hover:text-[var(--color-debate)]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-4)' }}
                aria-label="关闭"
              >
                ×
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {TOPIC_THUMBS.map(t => {
                  const isHighlight = thumb?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMaterialsZoomId(t.id)}
                      className="group flex flex-col overflow-hidden rounded-lg border bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{
                        borderColor: isHighlight
                          ? 'var(--color-debate)'
                          : 'var(--color-border)',
                        boxShadow: isHighlight
                          ? '0 0 0 2px var(--color-debate-soft)'
                          : 'none',
                      }}
                      title={`${
                        getMaterialKind(t.id) === 'video'
                          ? '点击播放'
                          : getMaterialKind(t.id) === 'doc'
                            ? '点击阅读'
                            : '点击放大'
                      } · ${t.label}`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-bg-page)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.src}
                          alt={t.label}
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                        {getMaterialKind(t.id) === 'video' && (
                          <>
                            <div
                              className="pointer-events-none absolute inset-0"
                              style={{
                                background:
                                  'linear-gradient(180deg, oklch(0.20 0 0 / 0.15) 0%, oklch(0.20 0 0 / 0.55) 100%)',
                              }}
                            />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              <span
                                className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-transform group-hover:scale-110"
                                style={{ background: 'var(--color-debate)' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                                  <path d="M3 1.5v11l9-5.5z" />
                                </svg>
                              </span>
                            </div>
                            <span
                              className="tnum absolute bottom-1.5 right-1.5 rounded px-1.5 py-0.5 text-[10px] text-white"
                              style={{ background: 'oklch(0.20 0 0 / 0.75)' }}
                            >
                              {MATERIAL_VIDEO_META[t.id]?.duration ?? '--:--'}
                            </span>
                          </>
                        )}
                        {getMaterialKind(t.id) === 'doc' && (
                          <span
                            className="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              background: 'oklch(0.99 0 0 / 0.94)',
                              color: 'var(--color-text)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            📄 {MATERIAL_DOC_BODY[t.id]?.pages ?? 1} 页
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <span
                          className="truncate text-[12px] font-medium"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {t.label}
                        </span>
                        {isHighlight && (
                          <span
                            className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]"
                            style={{
                              background: 'var(--color-debate-bg)',
                              color: 'var(--color-debate)',
                            }}
                          >
                            本场封面
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 二级阅读/播放层 */}
          {materialsZoomId && (() => {
            const z = TOPIC_THUMBS.find(t => t.id === materialsZoomId);
            if (!z) return null;
            return <MaterialReader asset={z} onClose={() => setMaterialsZoomId(null)} />;
          })()}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 资料阅读器 · 三种 kind 分支(image/video/doc)
// ─────────────────────────────────────────────────────────────

type MaterialAsset = { id: string; label: string; src: string };

function MaterialReader({ asset, onClose }: { asset: MaterialAsset; onClose: () => void }) {
  const kind = getMaterialKind(asset.id);
  if (kind === 'video') return <VideoMaterialReader asset={asset} onClose={onClose} />;
  if (kind === 'doc') return <DocMaterialReader asset={asset} onClose={onClose} />;
  return <ImageMaterialReader asset={asset} onClose={onClose} />;
}

function ImageMaterialReader({ asset, onClose }: { asset: MaterialAsset; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-8"
      style={{ background: 'oklch(0.20 0.01 80 / 0.75)' }}
      onClick={onClose}
    >
      <figure
        className="flex max-h-full max-w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.src} alt={asset.label} className="max-h-[78vh] w-auto object-contain" />
        <figcaption
          className="flex items-center justify-between gap-3 border-t px-5 py-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>
            {asset.label}
          </span>
          <button
            onClick={onClose}
            className="h-8 rounded-md border px-3 text-[12px] transition-colors hover:border-[var(--color-debate)] hover:text-[var(--color-debate)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
          >
            返回资料列表
          </button>
        </figcaption>
      </figure>
    </div>
  );
}

function VideoMaterialReader({ asset, onClose }: { asset: MaterialAsset; onClose: () => void }) {
  const meta = MATERIAL_VIDEO_META[asset.id];
  const durationSec = meta?.durationSec ?? 180;
  const [playing, setPlaying] = useState(false);
  const [progressMs, setProgressMs] = useState(0);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    startedAtRef.current = Date.now() - progressMs;
    const id = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      if (ms >= durationSec * 1000) {
        setProgressMs(durationSec * 1000);
        setPlaying(false);
      } else {
        setProgressMs(ms);
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const elapsedSec = Math.min(durationSec, Math.floor(progressMs / 1000));
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const progressPct = (elapsedSec / durationSec) * 100;
  const ended = elapsedSec >= durationSec;

  const activeIdx =
    meta?.transcript.reduce<number>((acc, tr, i) => {
      const [m, s] = tr.t.split(':').map(Number);
      const sec = m * 60 + s;
      return elapsedSec >= sec ? i : acc;
    }, -1) ?? -1;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-6"
      style={{ background: 'oklch(0.10 0 0 / 0.85)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-[1080px] flex-col overflow-hidden rounded-xl shadow-2xl md:flex-row"
        style={{ background: 'oklch(0.18 0.005 80)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative flex flex-1 flex-col">
          <div
            className="relative flex aspect-video items-center justify-center overflow-hidden"
            onClick={() => (ended ? (setProgressMs(0), setPlaying(true)) : setPlaying(p => !p))}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.src}
              alt={asset.label}
              className="h-full w-full object-cover transition-[filter] duration-200"
              style={{ filter: playing ? 'none' : 'brightness(0.65)' }}
            />
            {!playing && !ended && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setPlaying(true);
                }}
                className="absolute flex h-20 w-20 items-center justify-center rounded-full text-white shadow-2xl transition-transform hover:scale-110"
                style={{ background: 'var(--color-debate)' }}
                aria-label="播放"
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor" aria-hidden>
                  <path d="M6 3v22l18-11z" />
                </svg>
              </button>
            )}
            {ended && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setProgressMs(0);
                  setPlaying(true);
                }}
                className="absolute rounded-full px-4 py-2 text-[13px] text-white transition-colors hover:opacity-90"
                style={{ background: 'oklch(0.20 0 0 / 0.7)' }}
              >
                ↻ 重新播放
              </button>
            )}
            <span
              className="absolute top-3 left-3 flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-white"
              style={{ background: 'oklch(0.55 0.20 25 / 0.85)' }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: 'white',
                  animation: playing ? 'mat-rec-blink 1.2s infinite' : 'none',
                }}
              />
              视频
            </span>
            <style jsx>{`
              @keyframes mat-rec-blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
              }
            `}</style>
          </div>

          <div className="flex items-center gap-3 px-5 py-3" style={{ background: 'oklch(0.16 0.005 80)' }}>
            <button
              onClick={() => {
                if (ended) {
                  setProgressMs(0);
                  setPlaying(true);
                } else {
                  setPlaying(p => !p);
                }
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:opacity-90"
              style={{ background: 'var(--color-debate)' }}
              aria-label={playing ? '暂停' : '播放'}
            >
              {playing ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                  <rect x="2" y="1.5" width="3" height="9" />
                  <rect x="7" y="1.5" width="3" height="9" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                  <path d="M3 1.5v9l7-4.5z" />
                </svg>
              )}
            </button>
            <div
              className="relative h-1 flex-1 overflow-hidden rounded-full"
              style={{ background: 'oklch(0.32 0 0)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${progressPct}%`,
                  background: 'var(--color-debate)',
                  transition: playing ? 'width 0.1s linear' : 'none',
                }}
              />
            </div>
            <span className="tnum text-[11px] text-white/80">
              {fmt(elapsedSec)} / {meta?.duration ?? fmt(durationSec)}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-white">{asset.label}</div>
              <div className="text-[11px] text-white/55">辩论资料 · 视频(演示)</div>
            </div>
            <button
              onClick={onClose}
              className="ml-3 h-8 shrink-0 rounded-md border border-white/20 px-3 text-[12px] text-white transition-colors hover:border-white/60"
            >
              返回资料列表
            </button>
          </div>
        </div>

        <aside
          className="hidden w-[260px] shrink-0 overflow-y-auto border-l border-white/10 px-4 py-4 md:block"
          style={{ background: 'oklch(0.20 0.005 80)' }}
        >
          <div className="mb-3 text-[10px] font-medium tracking-[0.12em] text-white/45">
            字幕 · TRANSCRIPT
          </div>
          <ul className="flex flex-col gap-1.5">
            {meta?.transcript.map((tr, i) => (
              <li
                key={i}
                className="rounded-md px-2 py-2 text-[12px] leading-relaxed transition-colors"
                style={{
                  background: i === activeIdx ? 'oklch(0.32 0.06 25 / 0.45)' : 'transparent',
                  color: i === activeIdx ? 'oklch(0.96 0.02 25)' : 'oklch(0.72 0 0)',
                }}
              >
                <span className="tnum mr-2 text-[10px] text-white/45">{tr.t}</span>
                {tr.line}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function DocMaterialReader({ asset, onClose }: { asset: MaterialAsset; onClose: () => void }) {
  const doc = MATERIAL_DOC_BODY[asset.id];
  const totalPages = doc?.pages ?? 1;
  const [page, setPage] = useState(1);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-6"
      style={{ background: 'oklch(0.20 0.01 80 / 0.75)' }}
      onClick={onClose}
    >
      <article
        className="flex max-h-full w-full max-w-[820px] flex-col overflow-hidden rounded-xl border bg-white shadow-2xl"
        style={{ borderColor: 'var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <header
          className="flex shrink-0 items-center gap-3 border-b px-5 py-3"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-page)' }}
        >
          <span className="text-[16px]">📄</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>
              {asset.label}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-4)' }}>
              文档 · {totalPages} 页 · 仅供备课参考
            </div>
          </div>
          <div
            className="flex items-center rounded-md border"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 w-8 text-[14px] transition-colors enabled:hover:text-[var(--color-debate)] disabled:opacity-25"
              style={{ color: 'var(--color-text-2)' }}
              aria-label="上一页"
            >
              ‹
            </button>
            <span
              className="tnum px-2 text-[11px]"
              style={{ color: 'var(--color-text-2)' }}
            >
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-7 w-8 text-[14px] transition-colors enabled:hover:text-[var(--color-debate)] disabled:opacity-25"
              style={{ color: 'var(--color-text-2)' }}
              aria-label="下一页"
            >
              ›
            </button>
          </div>
          <button
            onClick={onClose}
            className="h-8 rounded-md border px-3 text-[12px] transition-colors hover:border-[var(--color-debate)] hover:text-[var(--color-debate)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
          >
            返回资料列表
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {page === 1 && (
            <div
              className="flex justify-center border-b py-6"
              style={{
                background: 'var(--color-bg-page)',
                borderColor: 'var(--color-border)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.src}
                alt={asset.label}
                className="max-h-[36vh] rounded-md object-contain shadow"
              />
            </div>
          )}
          <div className="px-10 py-8">
            <h2 className="mb-2 text-[20px] font-bold" style={{ color: 'var(--color-text)' }}>
              {asset.label}
            </h2>
            <div className="mb-6 h-px" style={{ background: 'var(--color-border)' }} />
            <div className="flex flex-col gap-5">
              {doc?.sections.map((sec, i) => (
                <section key={i}>
                  <h3
                    className="mb-1.5 text-[14px] font-semibold"
                    style={{ color: 'var(--color-debate)' }}
                  >
                    {sec.heading}
                  </h3>
                  <p
                    className="whitespace-pre-line text-[13px] leading-[1.85]"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {sec.body}
                  </p>
                </section>
              ))}
            </div>
            <div
              className="mt-8 flex items-center justify-between border-t pt-4 text-[11px]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-4)' }}
            >
              <span>—— 仅供备课参考,非真实公开文件 ——</span>
              <span className="tnum">
                第 {page} / {totalPages} 页
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

interface FighterProps {
  sideLabel: string;
  kindLabel: string;
  roleUrl?: string;
  argument?: string;
  argumentEdited: boolean;
  color: string;
  colorBg: string;
  colorEdge: string;
  speaking: boolean;
  bubble: { text: string; kind: 'live-ai' | 'live-input' | 'history' } | null;
  bubbleSide: 'pro' | 'con';
}

function Fighter({
  sideLabel,
  kindLabel,
  roleUrl,
  argument,
  argumentEdited,
  color,
  colorBg,
  colorEdge,
  speaking,
  bubble,
  bubbleSide,
}: FighterProps) {
  const pulseClass = speaking ? (bubbleSide === 'pro' ? 'pulse-ring-pro' : 'pulse-ring-con') : '';
  const bubbleRef = useRef<HTMLDivElement>(null);

  // 流式发言时自动贴底，避免新内容被裁掉看不到
  useEffect(() => {
    if (speaking && bubbleRef.current) {
      bubbleRef.current.scrollTop = bubbleRef.current.scrollHeight;
    }
  }, [bubble?.text, speaking]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-3 py-0.5 text-[13px] font-semibold"
          style={{ background: colorBg, color }}
        >
          {sideLabel}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--color-text-4)' }}>
          {kindLabel}
        </span>
        {speaking && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: colorBg, color }}
          >
            发言中
          </span>
        )}
      </div>

      {roleUrl ? (
        <div
          className={`overflow-hidden rounded-lg ${pulseClass}`}
          style={{
            width: '100%',
            maxWidth: 280,
            aspectRatio: '2 / 3',
            background: colorBg,
            border: `${speaking ? 3 : 2}px solid ${speaking ? color : colorEdge}`,
            transition: 'all 0.2s',
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
          className={`flex items-center justify-center rounded-lg text-[36px] font-bold ${pulseClass}`}
          style={{
            width: '100%',
            maxWidth: 280,
            aspectRatio: '2 / 3',
            background: colorBg,
            color,
            border: `2px dashed ${color}`,
          }}
        >
          ?
        </div>
      )}

      {argument && (
        <div
          className="w-full max-w-[280px] rounded-md border border-dashed px-2.5 py-1.5 text-left text-[12px] leading-relaxed"
          style={{
            borderColor: colorEdge,
            color: 'var(--color-text-2)',
            background: 'var(--color-bg-soft)',
          }}
          title={argument}
        >
          <span className="mr-1 opacity-60">📋</span>
          <span>{argument}</span>
          {argumentEdited && (
            <span
              className="ml-2 rounded-sm px-1 py-0.5 text-[10px]"
              style={{ background: 'var(--color-prep-bg)', color: 'var(--color-prep)' }}
            >
              本场临改
            </span>
          )}
        </div>
      )}

      {bubble && (
        <div
          ref={bubbleRef}
          className={`speech-bubble bubble-${bubbleSide} ${speaking ? 'live' : ''} w-full max-w-[280px] max-h-[140px] overflow-y-auto rounded-lg border px-3 py-2.5 text-left text-[13px] leading-relaxed`}
          style={
            {
              borderColor: speaking ? color : 'var(--color-border)',
              background: speaking ? colorBg : 'var(--color-bg-soft)',
              color: 'var(--color-text)',
              ['--bubble-bg' as string]: speaking ? colorBg : 'var(--color-bg-soft)',
            } as React.CSSProperties
          }
        >
          {bubble.kind === 'live-ai' && bubble.text === '' ? (
            <span style={{ color: 'var(--color-text-4)' }}>
              AI 思考中<span className="typing-caret" />
            </span>
          ) : bubble.kind === 'live-input' ? (
            <span style={{ color: 'var(--color-text-4)', fontStyle: 'italic' }}>{bubble.text}</span>
          ) : (
            <>
              {bubble.text}
              {speaking && bubble.kind === 'live-ai' && <span className="typing-caret" />}
            </>
          )}
          {!speaking && (
            <div className="mt-1.5 text-[10px]" style={{ color: 'var(--color-text-5)' }}>
              ↳ 最近发言
            </div>
          )}
        </div>
      )}
    </div>
  );
}
