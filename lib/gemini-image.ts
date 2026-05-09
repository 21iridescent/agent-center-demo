/**
 * AI 人物形象生成 — Gemini 3.1 Flash Image
 * 直连 generativelanguage.googleapis.com（不引 @ai-sdk/google，省一个依赖）
 * 需要 env GOOGLE_GENAI_API_KEY（**不**用 GEMINI_API_KEY — 避免与用户 shell rc 里
 * 可能存在的同名 export 冲突，Next 的 .env.local 不覆盖已设的 process.env）
 * 缺失时由 route handler 拦截
 *
 * 返回 base64 data URL，调用方直接放进 <img src=>，再随 agent.config 进 KV
 * 文档：https://ai.google.dev/gemini-api/docs/image-generation?hl=zh-cn
 */

const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';

const STYLE_SUFFIX =
  '教科书插画风, 暖色调纸质感, 中性白底, 无文字, 半身/全身可识别, 风格统一';

export interface PersonaImages {
  avatarDataUrl: string;
  roleDataUrl: string;
  sourcePrompt: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
  // SDK 写 inlineData，REST 也认 inline_data — 都兜一下
  inline_data?: { data: string; mime_type: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

async function generateOne(
  prompt: string,
  aspectRatio: string,
): Promise<{ data: string; mimeType: string }> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY missing');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        imageConfig: { aspectRatio, imageSize: '1K' },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as GeminiResponse;

  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked prompt: ${json.promptFeedback.blockReason}`);
  }
  if (json.error?.message) {
    throw new Error(`Gemini error: ${json.error.message}`);
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      return { data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'image/png' };
    }
    if (p.inline_data?.data) {
      return { data: p.inline_data.data, mimeType: p.inline_data.mime_type || 'image/png' };
    }
  }

  const finish = json.candidates?.[0]?.finishReason;
  throw new Error(`Gemini response missing image data${finish ? ` (finishReason=${finish})` : ''}`);
}

export async function generatePersonaImages(input: {
  name: string;
  traits?: string;
}): Promise<PersonaImages> {
  const subject = input.traits?.trim()
    ? `${input.name}（${input.traits.trim().slice(0, 100)}）`
    : input.name;
  const sourcePrompt = `${subject} | ${STYLE_SUFFIX}`;

  const [avatar, role] = await Promise.all([
    generateOne(`${sourcePrompt} | 半身肖像 | 居中 | 头部清晰`, '1:1'),
    generateOne(`${sourcePrompt} | 全身像 | 站立 | 整体可见`, '3:4'),
  ]);

  return {
    avatarDataUrl: `data:${avatar.mimeType};base64,${avatar.data}`,
    roleDataUrl: `data:${role.mimeType};base64,${role.data}`,
    sourcePrompt,
  };
}
