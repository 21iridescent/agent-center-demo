import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import { unifiedCreateAgent } from '@/lib/agents';

export const runtime = 'edge';
export const maxDuration = 30;

interface RequestBody {
  messages: UIMessage[];
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response('DEEPSEEK_API_KEY missing', { status: 500 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response('messages required', { status: 400 });
  }

  return createAgentUIStreamResponse({
    agent: unifiedCreateAgent,
    uiMessages: body.messages,
  });
}
