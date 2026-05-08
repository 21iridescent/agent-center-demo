'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

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
    const t = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2.5 text-[13px] text-white transition-all duration-200"
        style={{
          background: 'var(--color-text)',
          bottom: '32px',
          opacity: msg ? 1 : 0,
          transform: `translateX(-50%) translateY(${msg ? '0' : '20px'})`,
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
