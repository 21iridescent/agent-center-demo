'use client';

import { useEffect, useRef, useState } from 'react';

let _initialized = false;

interface Props {
  source: string;
}

/**
 * Mermaid 浏览器渲染
 * - dynamic import：mermaid 不进首屏 bundle（~100KB gz）
 * - 全局只 initialize 一次（用模块级 _initialized flag）
 * - paper 主题：从 CSS 变量取真实颜色（mermaid 的 themeVariables 不解析 var()）
 * - render 失败兜底渲源码 + 错误提示，不挂整页
 */
export function MermaidBlock({ source }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!_initialized) {
          const cs = getComputedStyle(document.body);
          const read = (name: string, fallback: string) =>
            cs.getPropertyValue(name).trim() || fallback;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'neutral',
            securityLevel: 'loose',
            fontFamily: 'inherit',
            themeVariables: {
              fontSize: '13px',
              primaryColor: read('--color-paper-card', '#fefbf5'),
              primaryBorderColor: read('--color-paper-rule', '#d2c6a9'),
              primaryTextColor: read('--color-ink-1', '#1f1a13'),
              lineColor: read('--color-ink-3', '#756a59'),
              secondaryColor: read('--color-paper-soft', '#f5edd8'),
              tertiaryColor: read('--color-paper-base', '#fbf6e9'),
            },
          });
          _initialized = true;
        }
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, source);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) {
    return (
      <pre
        className="my-2 px-3 py-2 text-[12px] leading-[1.6] whitespace-pre-wrap"
        style={{
          background: 'var(--color-paper-soft)',
          border: '1px dashed var(--color-paper-rule)',
          borderRadius: 'var(--radius-xs)',
          color: 'var(--color-ink-3)',
        }}
      >
        <span style={{ color: 'var(--color-type-debate)' }}>mermaid 渲染失败：</span>
        {error}
        {'\n\n'}
        <code style={{ color: 'var(--color-ink-2)' }}>{source}</code>
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="my-3 flex justify-center px-3 py-3 overflow-x-auto"
      style={{
        background: 'var(--color-paper-card)',
        border: '1px solid var(--color-paper-edge)',
        borderRadius: 'var(--radius-xs)',
      }}
    />
  );
}
