'use client';

import { PAPER_THEME } from './mermaid-theme';

/**
 * Markdown → .docx 下载（客户端入口）
 *
 * 为什么不直接在浏览器里跑 html-to-docx：
 * - html-to-docx@1.8 ESM build 顶层 import 'fs'，浏览器 bundler 解析失败
 * - 改走服务端 /api/export-docx：客户端只 POST markdown，拿回 blob 触发下载
 *
 * 为什么 mermaid 要在客户端预处理：
 * - 服务端没有 DOM，跑 mermaid 要 jsdom + headless chromium，太重
 * - 客户端 mermaid v11 已经在 MermaidBlock 里加载过；复用模块缓存
 * - 流程：source → SVG → canvas → PNG base64 → 替换 ```mermaid``` 块为 <img>
 *   marked 把 HTML 透传，html-to-docx 把 <img> 嵌成 Word 内嵌图
 *
 * 老师视角不变：点按钮 → .docx 下载到本地。延迟多 200-500ms 可接受。
 */
export async function exportMarkdownAsDocx(
  markdown: string,
  filename: string,
): Promise<void> {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
  const finalName = safeName.endsWith('.docx') ? safeName : `${safeName}.docx`;

  // mermaid 块预渲染成 PNG，否则 Word 里只能看到一段无渲染的源码
  const processed = await replaceMermaidWithImages(markdown);

  const res = await fetch('/api/export-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown: processed, filename: finalName }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`导出服务返回 ${res.status}: ${errText.slice(0, 120)}`);
  }
  const blob = await res.blob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const MERMAID_BLOCK_RE = /```mermaid\s*\n([\s\S]*?)\n```/g;

let _mermaidInitialized = false;

async function replaceMermaidWithImages(markdown: string): Promise<string> {
  // 没 mermaid 块直接返回，不去加载 ~100KB 的 mermaid bundle
  if (!MERMAID_BLOCK_RE.test(markdown)) return markdown;
  MERMAID_BLOCK_RE.lastIndex = 0;

  const mermaid = (await import('mermaid')).default;
  if (!_mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'inherit',
      themeVariables: PAPER_THEME,
    });
    _mermaidInitialized = true;
  }

  // 收集所有 match → 串行渲染（mermaid 用全局 id 计数器，不耐并发）
  const matches: { full: string; source: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = MERMAID_BLOCK_RE.exec(markdown)) !== null) {
    matches.push({ full: m[0], source: m[1] });
  }

  let result = markdown;
  for (const { full, source } of matches) {
    try {
      const id = `mermaid-export-${Math.random().toString(36).slice(2, 9)}`;
      const { svg } = await mermaid.render(id, source);
      const png = await svgToPngDataUrl(svg);
      const imgHtml = `\n\n<p><img src="${png}" alt="mermaid diagram" style="max-width:100%" /></p>\n\n`;
      result = result.replace(full, imgHtml);
    } catch (e) {
      // 失败兜底：保留原始代码块；用户至少能在 Word 里看到源码而不是导出整体崩溃
      // eslint-disable-next-line no-console
      console.warn('mermaid → png failed, keeping source block:', (e as Error).message);
    }
  }
  return result;
}

/**
 * SVG 字符串 → PNG dataURL
 * - blob URL + Image → canvas drawImage → toDataURL('image/png')
 * - 2x 像素密度，Word 里放大不糊
 * - 白底（mermaid 默认 transparent，Word 里贴黑底文档会发花）
 */
function svgToPngDataUrl(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 先解析出 SVG 的 width / height（mermaid 会写在根元素上），
    // 没有的话给个保守默认。
    const { width, height } = readSvgDimensions(svg);

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    const cleanup = () => URL.revokeObjectURL(url);

    img.onload = () => {
      try {
        const w = width || img.naturalWidth || 800;
        const h = height || img.naturalHeight || 600;
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return reject(new Error('canvas 2d context unavailable'));
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        cleanup();
        resolve(dataUrl);
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('SVG → Image 加载失败'));
    };
    img.src = url;
  });
}

function readSvgDimensions(svg: string): { width: number; height: number } {
  const wMatch = svg.match(/<svg[^>]*\swidth="([\d.]+)(?:px)?"/i);
  const hMatch = svg.match(/<svg[^>]*\sheight="([\d.]+)(?:px)?"/i);
  // viewBox fallback: "0 0 W H"
  const vbMatch = svg.match(/<svg[^>]*\sviewBox="([\d.\s-]+)"/i);
  let vbW = 0, vbH = 0;
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4) {
      vbW = parts[2];
      vbH = parts[3];
    }
  }
  return {
    width: wMatch ? parseFloat(wMatch[1]) : vbW,
    height: hMatch ? parseFloat(hMatch[1]) : vbH,
  };
}
