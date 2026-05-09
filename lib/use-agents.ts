'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_AGENTS,
  loadHiddenSeeds,
  saveHiddenSeeds,
  savedToSeed,
  type AgentSeed,
} from './agents-display';
import type { SavedAgent } from './agent-storage';

/**
 * 共用智能体列表读路径 —— 首页 ② 段 + /agents 全部页都要走这个 hook，
 * 不然两边的隐藏 seed 行为会对不齐（曾经只有首页读 localStorage 隐藏，
 * /agents 不读，导致老师"删过"的 seed 在 /agents 又复活）。
 *
 * 数据合流：
 *   - savedAgents：fetch '/api/agents' 拿到的 KV 真记录（已 mapped 到 AgentSeed）
 *   - INITIAL_AGENTS：源码硬编码的演示种子（filter 掉两条隐藏）
 *   - hiddenSeeds（localStorage）：用户在管理模式 "删" 过的 seed
 *   - hiddenSeedIds（KV）：编辑 seed copy-on-write 时同步的服务端隐藏集合
 *
 * fetch effect 自带 alive guard，挡住组件 unmount 后的 setState。
 */
export function useAgents() {
  const [savedAgents, setSavedAgents] = useState<AgentSeed[]>([]);
  const [hiddenSeeds, setHiddenSeeds] = useState<Set<string>>(new Set());
  const [hiddenSeedIds, setHiddenSeedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // 客户端 hydrate 后从 localStorage 读已隐藏 seed 列表
  useEffect(() => {
    setHiddenSeeds(loadHiddenSeeds());
  }, []);

  // 拉真实保存的智能体 + 服务端隐藏 seed 集合
  useEffect(() => {
    let alive = true;
    fetch('/api/agents')
      .then(r => r.json())
      .then((d: { agents?: SavedAgent[]; hiddenSeedIds?: string[] }) => {
        if (!alive) return;
        if (Array.isArray(d.agents)) setSavedAgents(d.agents.map(savedToSeed));
        if (Array.isArray(d.hiddenSeedIds)) setHiddenSeedIds(new Set(d.hiddenSeedIds));
      })
      .catch(() => {
        /* 静默：留 INITIAL_AGENTS 兜底，不白屏 */
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const seedAgents = useMemo(
    () =>
      INITIAL_AGENTS.filter(
        a => !hiddenSeeds.has(a.id) && !hiddenSeedIds.has(a.id),
      ),
    [hiddenSeeds, hiddenSeedIds],
  );

  const agents = useMemo(
    () => [...savedAgents, ...seedAgents],
    [savedAgents, seedAgents],
  );

  /** 删保存的智能体 → 调 DELETE API 后调用，本地 state 也撤一条 */
  const removeSavedLocally = useCallback((id: string) => {
    setSavedAgents(prev => prev.filter(a => a.id !== id));
  }, []);

  /** 用户在管理模式删 seed 卡 —— 加进 localStorage 隐藏集合 */
  const hideSeedLocally = useCallback((id: string) => {
    setHiddenSeeds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveHiddenSeeds(next);
      return next;
    });
  }, []);

  /** 编辑 seed copy-on-write 后调用 → 把原 seed id 加进 KV 隐藏集合的本地副本 */
  const markSeedHiddenRemote = useCallback((id: string) => {
    setHiddenSeedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  return {
    agents,
    savedAgents,
    loaded,
    removeSavedLocally,
    hideSeedLocally,
    markSeedHiddenRemote,
  };
}
