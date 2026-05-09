'use client';

/**
 * Markdown → .docx 下载（客户端入口）
 *
 * 为什么不直接在浏览器里跑 html-to-docx：
 * - html-to-docx@1.8 ESM build 顶层 import 'fs'，浏览器 bundler 解析失败
 * - 改走服务端 /api/export-docx：客户端只 POST markdown，拿回 blob 触发下载
 *
 * 老师视角不变：点按钮 → .docx 下载到本地。延迟多 200-500ms 可接受。
 */
export async function exportMarkdownAsDocx(
  markdown: string,
  filename: string,
): Promise<void> {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
  const finalName = safeName.endsWith('.docx') ? safeName : `${safeName}.docx`;

  const res = await fetch('/api/export-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, filename: finalName }),
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
