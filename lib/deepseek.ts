import { createOpenAI } from '@ai-sdk/openai';

/**
 * DeepSeek 走 OpenAI 兼容协议
 * base_url: https://api.deepseek.com
 * model:    deepseek-v4-flash
 */
export const deepseek = createOpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY!,
});

export const DEEPSEEK_MODEL = 'deepseek-v4-flash';
