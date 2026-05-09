/**
 * Mermaid paper 主题（hex）
 *
 * 不能从 CSS var 读：现代浏览器把 oklch() 解析成 lab(...) 字符串，
 * mermaid v11 的 color parser 不接受 lab() 会抛 "Unsupported color format"。
 *
 * 浏览器渲染（MermaidBlock）+ Word 导出预处理（word-export）共用一份。
 */
export const PAPER_THEME = {
  fontSize: '13px',
  primaryColor: '#fefbf5',        // paper-card
  primaryBorderColor: '#d2c6a9',  // paper-rule
  primaryTextColor: '#1f1a13',    // ink-1
  lineColor: '#756a59',           // ink-3
  secondaryColor: '#f5edd8',      // paper-soft
  tertiaryColor: '#fbf6e9',       // paper-base
} as const;
