'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface ToastCtx {
  show: (msg: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);

  const show = useCallback((m: string) => {
    setMsg(m);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {/* Toast · 投影 1m 可读 (≥16px) · 章式底 + 浮纸边线 */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 px-6 py-3 text-[16px] font-medium leading-snug transition-all"
        style={{
          background: 'var(--color-paper-stamp)',
          color: 'var(--color-paper-base)',
          bottom: '40px',
          opacity: msg ? 1 : 0,
          transform: `translateX(-50%) translateY(${msg ? '0' : '12px'})`,
          transitionDuration: '220ms',
          transitionTimingFunction: 'cubic-bezier(0.215, 0.61, 0.355, 1)', // ease-out-cubic
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-pop)',
          letterSpacing: '0.2px',
        }}
      >
        {msg ?? ''}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx.show;
}
