import { NextRequest } from 'next/server';

export const runtime = 'nodejs'; // html-to-docx 用 fs/path/crypto 等 Node 内置；不能跑 edge
export const maxDuration = 30;

interface RequestBody {
  markdown: string;
  filename?: string;
}

/**
 * Markdown → .docx 服务端导出
 *
 * 为何走服务端而非浏览器：
 * - html-to-docx@1.8 在 ESM build 里顶层 `import "fs"`，浏览器 bundler 无法解析
 * - 试过 turbopack/webpack fallback 都需要侵入 next.config 给 fs 打 stub，污染面大
 * - 服务端跑天然 OK；客户端只需 fetch 拿回 blob 触发下载
 *
 * 输入：JSON { markdown, filename }
 * 输出：blob (mime application/vnd.openxmlformats-officedocument.wordprocessingml.document)
 *      Content-Disposition: attachment; filename="..."
 */
export async function POST(req: NextRequest) {
  let payload: RequestBody;
  try {
    payload = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  const { markdown, filename } = payload;
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return new Response('markdown required', { status: 400 });
  }

  const [{ marked }, htmlDocxModule] = await Promise.all([
    import('marked'),
    import('html-to-docx'),
  ]);
  const htmlDocx = (
    (htmlDocxModule as unknown as { default?: unknown }).default ?? htmlDocxModule
  ) as (
    html: string,
    headerHTMLString?: string | null,
    options?: Record<string, unknown>,
  ) => Promise<Buffer | Blob | ArrayBuffer>;

  const html = marked.parse(markdown, { async: false }) as string;
  const wrapped = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;

  const docxBlob = await htmlDocx(wrapped, null, {
    margins: { top: 1080, right: 1080, bottom: 1080, left: 1080 }, // twips
    pageSize: { width: 12240, height: 15840 }, // A4-ish letter
    table: { row: { cantSplit: true } },
  });

  // 按运行时归一化为 Blob 给 Response — Node Buffer 既是 Uint8Array 也兼容 Blob 构造
  // Buffer/Uint8Array 走 ArrayBuffer 切片中转，避免 TS 抱怨 SharedArrayBuffer 不兼容
  const DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  let outBlob: Blob;
  if (docxBlob instanceof Uint8Array) {
    const ab = docxBlob.buffer.slice(
      docxBlob.byteOffset,
      docxBlob.byteOffset + docxBlob.byteLength,
    ) as ArrayBuffer;
    outBlob = new Blob([ab], { type: DOCX_MIME });
  } else if (typeof Blob !== 'undefined' && docxBlob instanceof Blob) {
    outBlob = docxBlob;
  } else if (docxBlob instanceof ArrayBuffer) {
    outBlob = new Blob([docxBlob], { type: DOCX_MIME });
  } else {
    return new Response('unexpected docx output type', { status: 500 });
  }

  const safeName = (filename ?? 'document').replace(/[\\/:*?"<>|]/g, '_');
  const finalName = safeName.endsWith('.docx') ? safeName : `${safeName}.docx`;

  return new Response(outBlob, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // 用 RFC 5987 + ASCII fallback 同时给：浏览器旧路径用 ascii，新浏览器解析 UTF-8
      'Content-Disposition': `attachment; filename="${encodeURIComponent(finalName)}"; filename*=UTF-8''${encodeURIComponent(finalName)}`,
      'Cache-Control': 'no-store',
    },
  });
}
