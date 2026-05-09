'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { PAPER_THEME } from '@/lib/mermaid-theme';

let _initialized = false;

interface Props {
  source: string;
}

/**
 * Mermaid 浏览器渲染
 * - hex 主题写死避开 lab() 解析问题
 * - 流式输入用 200ms debounce + parse 校验，避免半句源码把组件刷成 error
 * - SVG 走 state + dangerouslySetInnerHTML，父级 re-render 时不会清空 DOM
 * - React.memo：source 不变就完全跳过 re-render
 */
export const MermaidBlock = memo(function MermaidBlock({ source }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasRenderedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // 200ms debounce — 流式期间每个新 chunk 都会重置定时器，
    // 等用户/AI 停笔后才真正调 mermaid.render。
    const timer = window.setTimeout(async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!_initialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'neutral',
            securityLevel: 'loose',
            fontFamily: 'inherit',
            themeVariables: PAPER_THEME,
          });
          _initialized = true;
        }
        // parse 先校验一遍：流式中途的 source 可能语法不全，跳过这次渲染、
        // 让上一帧 SVG 继续显示，等下一帧再试。
        await mermaid.parse(source);
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const result = await mermaid.render(id, source);
        if (cancelled) return;
        setSvg(result.svg);
        setError(null);
        hasRenderedRef.current = true;
      } catch (e) {
        if (cancelled) return;
        // 已经渲过一次成功的 → 流式中途失败保留旧帧，不闪到错误提示
        if (!hasRenderedRef.current) {
          setError((e as Error).message);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [source]);

  if (error && !svg) {
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
      className="my-3 flex justify-center px-3 py-3 overflow-x-auto"
      style={{
        background: 'var(--color-paper-card)',
        border: '1px solid var(--color-paper-edge)',
        borderRadius: 'var(--radius-xs)',
        minHeight: svg ? undefined : 60,
      }}
      // SVG 由 state 驱动；父组件 re-render 不会让这块变白再填回来。
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
});
