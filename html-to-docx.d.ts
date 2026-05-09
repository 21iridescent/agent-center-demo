/**
 * Ambient type for html-to-docx (no @types package on npm).
 * Library has both default + namespace exports across bundlers; we accept either.
 */
declare module 'html-to-docx' {
  export interface HtmlToDocxOptions {
    margins?: { top?: number; right?: number; bottom?: number; left?: number };
    pageSize?: { width?: number; height?: number };
    table?: { row?: { cantSplit?: boolean } };
    [key: string]: unknown;
  }

  /** htmlDocx(html, headerHTML?, options?) → Blob in browsers / Buffer in node */
  function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    options?: HtmlToDocxOptions,
  ): Promise<Blob>;

  export default HTMLtoDOCX;
}
