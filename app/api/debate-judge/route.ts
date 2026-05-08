import { streamText } from 'ai';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';
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
  history: DebateTurnEntry[];
}

/**
 * POST /api/debate-judge — 辩论结束后 AI 评委点评（流式）
 *
 * 关键约定：评委必须在最末尾输出 <score>X.X</score> 标签，
 * 前端用正则 /<score>([\d.]+)<\/score>/ 提取数字。
 * XML 标签比 JSON 更抗流式中间态（流到一半时不需要解析整体）。
 */

const JUDGE_STYLE: Record<NonNullable<DebateAgentConfig['judgeTemplate']>, string> = {
  default: '平衡、专业，先客观、再点出关键问题',
  strict: '严格指出双方论证的逻辑漏洞和事实错误，不留情面',
  encouraging: '多鼓励双方亮点，温和指出可改进之处，适合低年级',
  neutral: '纯客观陈述事实和论点结构，不带感情色彩',
};

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
  if (!Array.isArray(body.history) || body.history.length === 0) {
    return new Response('history required', { status: 400 });
  }

  const cfg = body.agent.config as Partial<DebateAgentConfig>;
  const topic = cfg.topic ?? '（未指定辩题）';
  const grade = cfg.grade ?? '一年级';
  const judgeTemplate = cfg.judgeTemplate ?? 'default';
  const styleDesc = JUDGE_STYLE[judgeTemplate];

  // 把 history 拼成可读的辩论实录
  const transcript = body.history
    .map(h => `第 ${h.round} 轮 · ${h.side === 'pro' ? '正方' : '反方'}：${h.text}`)
    .join('\n\n');

  const system = `你是一位 AI 评委，刚听完关于「${topic}」的小学${grade}辩论。
评委风格：${styleDesc}

请按以下结构输出点评（不要 markdown 标题）：

【双方论点小结】
（≤ 120 字，把正反方各自的核心立场和最有力的论据各 1-2 条凝练出来）

【亮点】
正方：1-2 条
反方：1-2 条

【可改进】
正方：1-2 条
反方：1-2 条

【综合点评】
（≤ 80 字，给出本场辩论的整体评价）

在你输出的最末尾，单独一行输出综合评分（0-10 分小数，保留 1 位）：
<score>X.X</score>

要求：
- 措辞符合${grade}小学生能听懂的语气
- 不替任何一方"赢家"站台；评分基于论证质量、证据扎实程度、回应深度
- 必须以 <score>X.X</score> 结尾，否则前端无法提取分数`;

  const result = streamText({
    model: deepseek.chat(DEEPSEEK_MODEL),
    system,
    messages: [
      {
        role: 'user',
        content: `辩论实录如下：\n\n${transcript}\n\n请按格式给出点评和评分。`,
      },
    ],
    temperature: 0.5,
  });

  // 纯文本流 — DebateUsePage 自管 stream + 末尾正则提取 <score>X.X</score>
  return result.toTextStreamResponse();
}
