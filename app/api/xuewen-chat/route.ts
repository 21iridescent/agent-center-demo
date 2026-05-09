import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { deepseek, DEEPSEEK_MODEL, FAST_OPTS } from '@/lib/deepseek';
import { getAgent } from '@/lib/agent-storage';
import { parseAgentConfig } from '@/lib/agent-schemas';
import { getXuewenPersonaResolved } from '@/lib/asset-catalog';

export const runtime = 'nodejs';
export const maxDuration = 60; // reasoning 模型推理慢

/**
 * POST /api/xuewen-chat — 学问使用页流式对话
 *
 * body = { agentId: string, messages: UIMessage[] }
 * - 服务端 getAgent + Zod 校验，systemPrompt 由服务端拼（含角色背景 + 年级约束）
 *   ——客户端不再托管 system prompt，挡住浏览器 console 注入 / token 烧
 * - 用 streamText 直连 DeepSeek（不走 ToolLoopAgent，因为不需要 tools）
 * - 必须 deepseek.chat(...)，默认 deepseek(model) 走 Responses API 在 DeepSeek 上 404
 * - 必须 nodejs runtime；edge + DeepSeek 在 Phase 1 调试时挂过
 * - 沉浸式角色对话 → FAST_OPTS 关思考、不送 reasoning（露 chain-of-thought 会破戏）
 */
interface RequestBody {
  agentId: string;
  messages: UIMessage[];
}

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
  if (!body.agentId || typeof body.agentId !== 'string') {
    return new Response('agentId required', { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response('messages required', { status: 400 });
  }

  const agent = await getAgent(body.agentId);
  if (!agent) {
    return new Response('agent not found', { status: 404 });
  }
  if (agent.kind !== 'xuewen') {
    return new Response('agent kind mismatch', { status: 400 });
  }
  // Zod parse on read：seed/saved agent 都跑同一道闸，留足以构造 prompt 的字段
  const validated = parseAgentConfig('xuewen', agent.config);
  if (!validated.ok || validated.data.kind !== 'xuewen') {
    console.error('xuewen-chat: agent config invalid', body.agentId, validated.ok ? 'kind mismatch' : validated.error);
    return new Response('agent config invalid', { status: 422 });
  }
  const cfg = validated.data.config; // narrowed to XuewenAgentConfig
  const persona = getXuewenPersonaResolved({
    personaId: cfg.personaId,
    personaCustom: cfg.personaCustom,
    name: cfg.name,
  });
  const personaLabel = persona.label ?? cfg.name;

  const systemPrompt = `你是${cfg.name}（原型：${personaLabel}），${cfg.background}

对话原则：
- 服务对象是${cfg.grade}小学生，用词浅显有比喻，避免学术术语
- 始终保持人物口吻和性格，第一人称
- 单轮回答 80-200 字，避免长篇大论
- 不偏离${cfg.subject}学科范围
- 当学生问到你时代之后的事或非本学科话题，礼貌引回主线`;

  const modelMessages = await convertToModelMessages(body.messages);

  const result = streamText({
    model: deepseek.chat(DEEPSEEK_MODEL),
    system: systemPrompt,
    messages: modelMessages,
    temperature: 0.7,
    ...FAST_OPTS,
  });

  return result.toUIMessageStreamResponse();
}
