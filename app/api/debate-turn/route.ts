import { streamText } from 'ai';
import { deepseek, DEEPSEEK_MODEL, FAST_OPTS } from '@/lib/deepseek';
import type { SavedAgent } from '@/lib/agent-storage';
import type { DebateAgentConfig } from '@/lib/agent-schemas';

export const runtime = 'nodejs';
export const maxDuration = 60; // reasoning 模型推理慢；textStreamResponse 会等 reasoning 走完才出 text

interface DebateTurnEntry {
  round: number;
  side: 'pro' | 'con';
  text: string;
}

interface RequestBody {
  agent: SavedAgent;
  side: 'pro' | 'con';
  history: DebateTurnEntry[];
  currentRound: number; // 1-indexed
}

/**
 * POST /api/debate-turn — AI 方一次自动发言（流式）
 *
 * 把"辩题/双方论点/对方上一轮/本方此前发言"全部塞进 system，
 * user message 只是一句"请发言"——这样辩论上下文是无状态的，
 * 每次调用从 history 重建，不依赖 useChat 那种 message 数组结构。
 */
export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response('OPENROUTER_API_KEY missing', { status: 500 });
  }
  if (!body.agent || body.agent.kind !== 'debate') {
    return new Response('agent (kind=debate) required', { status: 400 });
  }
  if (body.side !== 'pro' && body.side !== 'con') {
    return new Response('side must be pro|con', { status: 400 });
  }
  if (!Array.isArray(body.history)) {
    return new Response('history required', { status: 400 });
  }
  if (typeof body.currentRound !== 'number' || body.currentRound < 1) {
    return new Response('currentRound required', { status: 400 });
  }

  const cfg = body.agent.config as Partial<DebateAgentConfig>;
  const topic = cfg.topic ?? '（未指定辩题）';
  const background = cfg.background ?? '';
  const grade = cfg.grade ?? '一年级';
  const totalRounds = cfg.totalRounds ?? 3;

  const own = body.side === 'pro' ? cfg.proSide : cfg.conSide;
  const opp = body.side === 'pro' ? cfg.conSide : cfg.proSide;
  const ownLabel = body.side === 'pro' ? '正方' : '反方';
  const oppLabel = body.side === 'pro' ? '反方' : '正方';

  // 找对方"上一轮"发言（最近一条 side != 自己的）
  const lastOpp = [...body.history].reverse().find(h => h.side !== body.side);
  // 找己方此前所有发言
  const ownPrior = body.history.filter(h => h.side === body.side);

  const system = `你正在参与一场针对小学${grade}学生的辩论。
辩题：${topic}
辩题背景：${background}

你代表【${ownLabel}】，你方核心论点：${own?.argument ?? '（未指定）'}
对方代表【${oppLabel}】，其核心论点：${opp?.argument ?? '（未指定）'}

当前是第 ${body.currentRound} 轮，共 ${totalRounds} 轮。

发言要求：
- 单次发言控制在 80-150 字
- 结构：① 承接/反驳对方上一轮的具体观点 → ② 引出你方新论据或例子 → ③ 结尾一句呼吁或反问
- 措辞要符合${grade}小学生认知水平：用具体例子，不堆术语
- 立场鲜明，不模棱两可；不要重复你方此前说过的原话
- 不要写"作为正方/反方"这类元叙述，直接进入观点

对方上一轮说了：${lastOpp ? `「${lastOpp.text}」` : '（你方先发言，主动立论）'}

你方此前发言（避免重复）：
${ownPrior.length > 0 ? ownPrior.map((h, i) => `第 ${h.round} 轮：${h.text}`).join('\n') : '（你方还没发过言）'}`;

  const result = streamText({
    model: deepseek.chat(DEEPSEEK_MODEL),
    system,
    messages: [
      {
        role: 'user',
        content: `请你以${ownLabel}身份发言，单段直出。`,
      },
    ],
    temperature: 0.8,
    // 一轮限时 60-300s，思考会吃掉发言时间 → 关
    ...FAST_OPTS,
  });

  // 返回纯文本流（非 UI message 格式）— 前端 fetch + reader 直接累加 chunk
  // useChat 不适合「轮次×方」二维 history，所以 DebateUsePage 自管 stream
  return result.toTextStreamResponse();
}
