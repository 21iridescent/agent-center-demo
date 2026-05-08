import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import { unifiedCreateAgent, CREATE_AGENTS } from '@/lib/agents';
import type { CreateKind } from '@/lib/agent-schemas';

export const runtime = 'edge';
export const maxDuration = 60; // reasoning 模型推理较慢，给足窗口

interface RequestBody {
  messages: UIMessage[];
  kind?: CreateKind; // 可选：模板路径 /create/[kind] 会传；对话式 /create 不传
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

  // /create/[kind] 模板路径：按 kind 分发到 single-tool agent（更可控的输出）
  if (body.kind) {
    switch (body.kind) {
      case 'xuewen':
        return createAgentUIStreamResponse({
          agent: CREATE_AGENTS.xuewen,
          uiMessages: body.messages,
          sendReasoning: true,
        });
      case 'debate':
        return createAgentUIStreamResponse({
          agent: CREATE_AGENTS.debate,
          uiMessages: body.messages,
          sendReasoning: true,
        });
      case 'discussion':
        return createAgentUIStreamResponse({
          agent: CREATE_AGENTS.discussion,
          uiMessages: body.messages,
          sendReasoning: true,
        });
      default:
        return new Response(`unknown create kind: ${String(body.kind)}`, { status: 400 });
    }
  }

  // /create 对话式路径：unifiedCreateAgent 让 LLM 自路由
  return createAgentUIStreamResponse({
    agent: unifiedCreateAgent,
    uiMessages: body.messages,
    sendReasoning: true,
  });
}
