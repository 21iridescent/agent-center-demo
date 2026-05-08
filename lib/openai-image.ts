import { createOpenAI } from '@ai-sdk/openai';
import { generateImage } from 'ai';

/**
 * AI 人物形象生成 — 直连 api.openai.com（OpenRouter 对 image gen 支持不稳）
 * 需要 env OPENAI_API_KEY；缺失时由 route handler 拦截
 *
 * 返回 base64 data URL，调用方直接放进 <img src=>，再随 agent.config 进 KV
 */
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? '',
});

const STYLE_SUFFIX =
  '教科书插画风, 暖色调纸质感, 中性白底, 无文字, 半身/全身可识别, 风格统一';

export interface PersonaImages {
  avatarDataUrl: string;
  roleDataUrl: string;
  sourcePrompt: string;
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
    generateImage({
      model: openai.image('gpt-image-1'),
      prompt: `${sourcePrompt} | 半身肖像 | 居中 | 头部清晰`,
      size: '1024x1024',
    }),
    generateImage({
      model: openai.image('gpt-image-1'),
      prompt: `${sourcePrompt} | 全身像 | 站立 | 整体可见`,
      size: '1024x1536',
    }),
  ]);

  const avatarMime = avatar.image.mediaType || 'image/png';
  const roleMime = role.image.mediaType || 'image/png';

  return {
    avatarDataUrl: `data:${avatarMime};base64,${avatar.image.base64}`,
    roleDataUrl: `data:${roleMime};base64,${role.image.base64}`,
    sourcePrompt,
  };
}
