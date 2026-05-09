import { tool } from 'ai';
import { z } from 'zod';

/**
 * Exa 联网工具集
 * - web_search   通用搜索（标题/摘要/URL）
 * - crawl_url    抓取指定 URL 正文（4000 字截断防止 context 爆）
 * - find_similar 给定 URL 找类似站点（拓展同源资料）
 *
 * 直接 fetch 不引入 exa-js（项目其他外部 API 也用 fetch，保持一致）。
 * 失败时 throw —— AI SDK 把 error 作为 tool-result 的 output-error 状态发给 UI，
 * agent 收到后可以选择换工具或收尾。
 */

const EXA_BASE = 'https://api.exa.ai';

interface ExaSearchResult {
  title: string;
  url: string;
  text?: string;
  publishedDate?: string;
}

function getApiKey(): string {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error('EXA_API_KEY missing — 在 .env.local 配置后重启 dev');
  return key;
}

export const webSearch = tool({
  description:
    '使用 Exa 联网搜索网页（返回标题、摘要、URL）。当需要查证课程标准、教材最新版本、确认事实，或者寻找小学科学/AI 教育案例时调用。中文 query 优先；query 越具体越好（如"教科版三年级科学 光的反射 单元目标"）。',
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .max(120)
      .describe('搜索词，2-120 字；中文优先；建议含学科+年级+主题三要素'),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .describe('返回结果数；默认 3，最多 5'),
  }),
  execute: async ({ query, numResults = 3 }) => {
    const apiKey = getApiKey();
    const res = await fetch(`${EXA_BASE}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        query,
        numResults,
        type: 'auto',
        contents: { text: { maxCharacters: 400 } },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Exa search failed: ${res.status} ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as { results?: ExaSearchResult[] };
    const results = data.results ?? [];
    return results.slice(0, numResults).map(r => ({
      title: r.title,
      url: r.url,
      snippet: (r.text ?? '').slice(0, 200),
      publishedDate: r.publishedDate,
    }));
  },
});

export const crawlUrl = tool({
  description:
    '抓取指定 URL 的正文（markdown / 纯文本，截断到 4000 字）。当 web_search 拿到一个高相关链接、需要读全文时调用。',
  inputSchema: z.object({
    url: z.string().url().describe('要抓取的完整 URL（包含 https://）'),
  }),
  execute: async ({ url }) => {
    const apiKey = getApiKey();
    const res = await fetch(`${EXA_BASE}/contents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        urls: [url],
        text: { maxCharacters: 4000 },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Exa contents failed: ${res.status} ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as { results?: ExaSearchResult[] };
    const r = data.results?.[0];
    if (!r) throw new Error('Exa contents: 未返回结果');
    return {
      title: r.title,
      url: r.url,
      text: (r.text ?? '').slice(0, 4000),
      publishedDate: r.publishedDate,
    };
  },
});

export const findSimilar = tool({
  description:
    '给定一个 URL，找其他类似站点（多课程出处、同主题不同教材角度）。当 web_search/crawl_url 找到一个好链接、想拓展同源资料时调用。',
  inputSchema: z.object({
    url: z.string().url().describe('参考的 URL'),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .describe('返回结果数；默认 3，最多 5'),
  }),
  execute: async ({ url, numResults = 3 }) => {
    const apiKey = getApiKey();
    const res = await fetch(`${EXA_BASE}/findSimilar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        url,
        numResults,
        contents: { text: { maxCharacters: 400 } },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Exa findSimilar failed: ${res.status} ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as { results?: ExaSearchResult[] };
    const results = data.results ?? [];
    return results.slice(0, numResults).map(r => ({
      title: r.title,
      url: r.url,
      snippet: (r.text ?? '').slice(0, 200),
      publishedDate: r.publishedDate,
    }));
  },
});
