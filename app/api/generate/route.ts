import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import { PREP_AGENTS } from '@/lib/agents';
import type { PrepKind } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 30;

interface RequestBody {
  messages: UIMessage[];
  kind: PrepKind;
}

const VALID_KINDS: PrepKind[] = ['outline', 'lesson', 'exercise', 'activity'];

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
  if (!VALID_KINDS.includes(kind)) {
    return new Response(`unknown kind: ${kind}`, { status: 400 });
  }

  return createAgentUIStreamResponse({
    agent: PREP_AGENTS[kind],
    uiMessages: messages,
  });
}
