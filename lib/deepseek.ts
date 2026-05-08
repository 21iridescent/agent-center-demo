import { createOpenAI } from '@ai-sdk/openai';

/**
 * LLM provider — 走 OpenRouter（OpenAI 兼容协议，多模型聚合网关）
 *   baseURL: https://openrouter.ai/api/v1
 *   env:     OPENROUTER_API_KEY
 *   model:   OpenRouter 上的任意模型 id（"provider/model-name"）
 *
 * 历史名 `deepseek` / `DEEPSEEK_MODEL` 保留以最小化改动面（agents/route.ts 都引用这两个名字）；
 * 实际后端是 OpenRouter，模型也可以非 DeepSeek
 */
export const deepseek = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const DEEPSEEK_MODEL = 'tencent/hy3-preview:free';
