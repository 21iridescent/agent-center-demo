import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import {
  outlineAgent,
  lessonAgent,
  exerciseAgent,
  activityAgent,
  projectAgent,
} from '@/lib/agents/prep';
import type { PrepKind } from '@/lib/types';

export const runtime = 'nodejs'; // 跟其他 chat 路由对齐；edge 在 Hobby 上限只有 25s，对 reasoning 模型不够
export const maxDuration = 60; // reasoning 模型推理较慢，给足窗口

interface ContextField {
  label: string;
  value: string;
}

interface RequestBody {
  messages: UIMessage[];
  kind: PrepKind;
  context?: ContextField[];                    // 课题/学科/年级 — 来自 ContextStrip
  params?: Record<string, string | number>;    // 长度/难度/时长/题量分布 — 来自 ContextStrip
}

const VALID_KINDS: PrepKind[] = ['outline', 'lesson', 'exercise', 'activity', 'project'];

/**
 * 把 context + params 拼成一条 system UIMessage 前置到 messages，
 * 让 agent 一开局就知道当前备课上下文（替代构造期固定 instructions 的方式）。
 * 没 context 也没 params 时返 null，调用方跳过注入。
 */
function buildContextMessage(
  context: ContextField[] | undefined,
  params: Record<string, string | number> | undefined,
): UIMessage | null {
  const lines: string[] = [];
  if (context && context.length) {
    lines.push('## 当前备课上下文');
    for (const f of context) lines.push(`- ${f.label}：${f.value}`);
  }
  if (params && Object.keys(params).length) {
    lines.push('## 参数');
    for (const [k, v] of Object.entries(params)) lines.push(`- ${k}：${v}`);
  }
  if (!lines.length) return null;
  return {
    id: 'sys-context',
    role: 'system',
    parts: [{ type: 'text', text: lines.join('\n') }],
  } as UIMessage;
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  const { messages, kind, context, params } = body;

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response('OPENROUTER_API_KEY missing', { status: 500 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages required', { status: 400 });
  }
  if (!VALID_KINDS.includes(kind)) {
    return new Response(`unknown kind: ${kind}`, { status: 400 });
  }

  const ctxMsg = buildContextMessage(context, params);
  const uiMessages = ctxMsg ? [ctxMsg, ...messages] : messages;

  // 用 switch 而非 PREP_AGENTS[kind] 索引：每个 agent 的 TOOLS 类型签名不同（invariant 泛型），
  // 索引访问会触发类型并集 → createAgentUIStreamResponse 推断不出统一 TOOLS。
  // switch 让每条分支都拿到具体 agent 类型，TS 推断干净。
  switch (kind) {
    case 'outline':
      return createAgentUIStreamResponse({
        agent: outlineAgent,
        uiMessages,
        sendReasoning: false,
      });
    case 'lesson':
      return createAgentUIStreamResponse({
        agent: lessonAgent,
        uiMessages,
        sendReasoning: false,
      });
    case 'exercise':
      return createAgentUIStreamResponse({
        agent: exerciseAgent,
        uiMessages,
        sendReasoning: false,
      });
    case 'activity':
      return createAgentUIStreamResponse({
        agent: activityAgent,
        uiMessages,
        sendReasoning: false,
      });
    case 'project':
      return createAgentUIStreamResponse({
        agent: projectAgent,
        uiMessages,
        sendReasoning: false,
      });
  }
}
