import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import { CREATE_AGENTS } from '@/lib/agents';
import type { CreateKind } from '@/lib/agent-schemas';

export const runtime = 'edge';
export const maxDuration = 30;

interface RequestBody {
  messages: UIMessage[];
  kind: CreateKind;
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  const { messages, kind } = body;

  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response('DEEPSEEK_API_KEY missing', { status: 500 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages required', { status: 400 });
  }

  // 按 kind 字面量分发给具体 agent —— 让 TS 在 createAgentUIStreamResponse 调用处
  // 推到具体的 ToolSet 类型，避免传 union 时的 TOOLS 泛型不匹配
  switch (kind) {
    case 'xuewen':
      return createAgentUIStreamResponse({
        agent: CREATE_AGENTS.xuewen,
        uiMessages: messages,
      });
    case 'debate':
      return createAgentUIStreamResponse({
        agent: CREATE_AGENTS.debate,
        uiMessages: messages,
      });
    case 'discussion':
      return createAgentUIStreamResponse({
        agent: CREATE_AGENTS.discussion,
        uiMessages: messages,
      });
    default:
      return new Response(`unknown create kind: ${String(kind)}`, { status: 400 });
  }
}
