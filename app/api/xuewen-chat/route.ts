import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';

export const runtime = 'nodejs';
export const maxDuration = 60; // reasoning 模型推理慢

/**
 * POST /api/xuewen-chat — 学问使用页流式对话
 *
 * body = { messages: UIMessage[], systemPrompt: string }
 * - 不在服务端 fetch agent；prompt 由客户端拼好（含角色背景 + 年级约束）
 * - 用 streamText 直连 DeepSeek（不走 ToolLoopAgent，因为不需要 tools）
 * - 必须 deepseek.chat(...)，默认 deepseek(model) 走 Responses API 在 DeepSeek 上 404
 * - 必须 nodejs runtime；edge + DeepSeek 在 Phase 1 调试时挂过
 */
interface RequestBody {
  messages: UIMessage[];
  systemPrompt: string;
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
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response('messages required', { status: 400 });
  }
  if (!body.systemPrompt || typeof body.systemPrompt !== 'string') {
    return new Response('systemPrompt required', { status: 400 });
  }

  const modelMessages = await convertToModelMessages(body.messages);

  const result = streamText({
    model: deepseek.chat(DEEPSEEK_MODEL),
    system: body.systemPrompt,
    messages: modelMessages,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
