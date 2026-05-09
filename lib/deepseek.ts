import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * LLM provider — OpenRouter 官方 AI SDK provider
 *   baseURL 默认 https://openrouter.ai/api/v1
 *   env:    OPENROUTER_API_KEY
 *   model:  OpenRouter 上的任意模型 id（"provider/model-name"）
 *
 * 历史名 `deepseek` / `DEEPSEEK_MODEL` 保留以最小化改动面（路由/agent 全部引用）。
 *
 * Reasoning：**全站关闭**
 *   - effort: 'none' + exclude: true → 模型不思考、不发 reasoning 段
 *   - QUALITY_OPTS / FAST_OPTS 都收敛到同一份 reasoning 配置；保留两个名字仅为
 *     避免大面积改 import；将来要重新分档再分裂
 */

export const deepseek = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const DEEPSEEK_MODEL =
  process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash';

/* ───────────────────────────────────────────────────────────────
   Per-route 预设 — reasoning 全部关闭
   ─────────────────────────────────────────────────────────────── */

const NO_REASONING = {
  providerOptions: {
    openrouter: {
      reasoning: { effort: 'none' as const, exclude: true },
    },
  },
};

/** 历史名保留 — 现已等同于 FAST_OPTS（reasoning 全关） */
export const QUALITY_OPTS = NO_REASONING;

/** 快、不思考：辩论一轮发言 / 虚拟人对话 / 主持 */
export const FAST_OPTS = NO_REASONING;
