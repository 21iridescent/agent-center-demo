'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidBlock } from './MermaidBlock';

interface Props {
  source: string;
}

/**
 * Markdown 渲染器（assistant 输出专用）
 * - GFM：表格、删除线、任务列表
 * - 自定义组件套 paper 风格 token；不引入新字体
 * - language-mermaid 代码块本期渲降级 pre + 提示（实渲染留 plan #2）
 */
export function MarkdownRenderer({ source }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: props => (
          <h1
            className="font-display text-[20px] font-medium mt-3 mb-2"
            style={{ color: 'var(--color-ink-1)' }}
            {...props}
          />
        ),
        h2: props => (
          <h2
            className="font-display text-[17px] font-medium mt-3 mb-1.5 border-l-2 pl-2.5"
            style={{
              color: 'var(--color-ink-1)',
              borderColor: 'var(--color-paper-stamp)',
            }}
            {...props}
          />
        ),
        h3: props => (
          <h3
            className="font-display text-[15px] font-medium mt-2.5 mb-1"
            style={{ color: 'var(--color-ink-1)' }}
            {...props}
          />
        ),
        p: props => (
          <p
            className="my-1.5 leading-[1.7]"
            style={{ color: 'var(--color-ink-1)' }}
            {...props}
          />
        ),
        ul: props => <ul className="list-disc pl-5 my-1.5 space-y-0.5" {...props} />,
        ol: props => <ol className="list-decimal pl-5 my-1.5 space-y-0.5" {...props} />,
        li: props => (
          <li
            className="leading-[1.7]"
            style={{ color: 'var(--color-ink-1)' }}
            {...props}
          />
        ),
        strong: props => (
          <strong
            className="font-medium"
            style={{ color: 'var(--color-ink-1)' }}
            {...props}
          />
        ),
        em: props => <em style={{ color: 'var(--color-ink-2)' }} {...props} />,
        blockquote: props => (
          <blockquote
            className="border-l-2 pl-3 my-2 italic"
            style={{
              borderColor: 'var(--color-paper-rule)',
              color: 'var(--color-ink-2)',
            }}
            {...props}
          />
        ),
        table: props => (
          <div className="my-2 overflow-x-auto">
            <table
              className="border-collapse text-[13px]"
              style={{ borderColor: 'var(--color-paper-rule)' }}
              {...props}
            />
          </div>
        ),
        th: props => (
          <th
            className="border px-2 py-1 text-left font-display"
            style={{
              borderColor: 'var(--color-paper-rule)',
              background: 'var(--color-paper-soft)',
              color: 'var(--color-ink-1)',
            }}
            {...props}
          />
        ),
        td: props => (
          <td
            className="border px-2 py-1"
            style={{
              borderColor: 'var(--color-paper-rule)',
              color: 'var(--color-ink-1)',
            }}
            {...props}
          />
        ),
        a: props => (
          <a
            className="underline decoration-dotted underline-offset-2"
            style={{ color: 'var(--color-type-dialogue)' }}
            target="_blank"
            rel="noreferrer"
            {...props}
          />
        ),
        code: ({ className, children, ...rest }) => {
          const lang = /language-(\w+)/.exec(className ?? '')?.[1];
          if (lang === 'mermaid') {
            const source = String(children ?? '').replace(/\n$/, '');
            return <MermaidBlock source={source} />;
          }
          // 行内 code
          return (
            <code
              className={className}
              style={{
                background: 'var(--color-paper-soft)',
                padding: '0 4px',
                borderRadius: 2,
                fontSize: '0.9em',
              }}
              {...rest}
            >
              {children}
            </code>
          );
        },
        pre: props => (
          <pre
            className="my-2 px-3 py-2 text-[12px] leading-[1.6] overflow-x-auto"
            style={{
              background: 'var(--color-paper-soft)',
              border: '1px solid var(--color-paper-rule)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--color-ink-2)',
            }}
            {...props}
          />
        ),
        hr: props => (
          <hr
            className="my-3 border-t"
            style={{ borderColor: 'var(--color-paper-rule)' }}
            {...props}
          />
        ),
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
