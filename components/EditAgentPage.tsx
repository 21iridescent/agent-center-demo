'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/Toast';
import { XuewenForm } from '@/components/AgentForm/Xuewen';
import { DebateForm } from '@/components/AgentForm/Debate';
import { DiscussionForm } from '@/components/AgentForm/Discussion';
import type { SavedAgent } from '@/lib/agent-storage';
import {
  CREATE_KIND_LABEL,
  type XuewenAgentConfig,
  type DebateAgentConfig,
  type DiscussionAgentConfig,
} from '@/lib/agent-schemas';

interface Props {
  agent: SavedAgent;
  isSeed: boolean;
}

/**
 * 智能体直接编辑页（无 AI 对话）
 *
 * - 一进来表单已用 agent.config 预填
 * - 保存：KV 真记录走 PUT；seed 走 copy-on-write（POST 创建 + POST hide-seed 隐藏原 seed）
 * - 取消：返首页，不写库
 */
export function EditAgentPage({ agent, isSeed }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [formState, setFormState] = useState<Record<string, unknown>>(agent.config);
  const [saving, setSaving] = useState(false);

  const name = (formState as { name?: string }).name ?? '未命名';

  function validateRequired(): string | null {
    const f = formState as Record<string, unknown>;
    if (typeof f.name !== 'string' || !f.name.trim()) return '名称不能空';
    if (!f.subject) return '学科必选';
    if (!f.grade) return '年级必选';
    if (agent.kind === 'xuewen') {
      if (typeof f.background !== 'string' || f.background.trim().length < 10) {
        return '角色背景至少 10 字';
      }
    }
    if (agent.kind === 'debate') {
      if (typeof f.topic !== 'string' || !f.topic.trim()) return '辩题必填';
    }
    if (agent.kind === 'discussion') {
      if (typeof f.topic !== 'string' || !f.topic.trim()) return '讨论主题必填';
      if (typeof f.hostName !== 'string' || !f.hostName.trim()) return '主持人名称必填';
    }
    return null;
  }

  async function handleSave() {
    const err = validateRequired();
    if (err) {
      toast(err);
      return;
    }

    setSaving(true);
    try {
      if (isSeed) {
        // copy-on-write: 先建副本，再隐藏原 seed
        const r = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: agent.kind, config: formState }),
        });
        if (!r.ok) {
          toast('保存失败：服务暂不可用');
          setSaving(false);
          return;
        }
        // 隐藏 seed 失败不阻塞 —— 副本已建好，原 seed 还在最坏只是会同时显示
        try {
          await fetch(`/api/agents/${encodeURIComponent(agent.id)}/hide-seed`, {
            method: 'POST',
          });
        } catch {
          // 静默
        }
      } else {
        const r = await fetch(`/api/agents/${encodeURIComponent(agent.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: agent.kind, config: formState }),
        });
        if (!r.ok) {
          toast('保存失败：服务暂不可用');
          setSaving(false);
          return;
        }
      }
      toast(`已保存：${name}`);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 700);
    } catch {
      toast('保存失败：网络错误');
      setSaving(false);
    }
  }

  function handleCancel() {
    router.push('/');
  }

  return (
    <>
      <Topbar
        crumb={`编辑 · ${name}`}
        right={
          <>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-md border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50 hover:border-[var(--color-paper-stamp)]"
              style={{ borderColor: 'var(--color-paper-edge)', color: 'var(--color-ink-3)' }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md px-4 py-1.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
              style={{ background: 'var(--color-paper-stamp)' }}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </>
        }
      />
      <main
        className="mx-auto w-full px-10 pt-8 pb-16"
        style={{ maxWidth: 'var(--container-list)' }}
      >
        <header
          className="mb-6 flex items-end gap-5 border-t pt-5"
          style={{ borderColor: 'var(--color-paper-rule)' }}
        >
          <span
            className="stamp h-10 w-10 shrink-0 text-[12px]"
            style={{ borderRadius: 'var(--radius-xs)' }}
            aria-hidden
          >
            EDIT
          </span>
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            <div
              className="font-numeric text-[10px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--color-type-dialogue-deep)' }}
            >
              编辑智能体 · {CREATE_KIND_LABEL[agent.kind]}
            </div>
            <h1
              className="font-display text-[26px] font-medium leading-tight tracking-[0.5px]"
              style={{ color: 'var(--color-ink-1)' }}
            >
              {name}
            </h1>
            {isSeed && (
              <div
                className="mt-1 rounded-md border px-3 py-2 text-[12px]"
                style={{
                  background: 'var(--color-paper-soft)',
                  borderColor: 'var(--color-paper-edge)',
                  color: 'var(--color-ink-3)',
                }}
              >
                正在编辑 demo 内置模板。保存后会创建你自己的副本，原模板会从首页列表中隐藏。
              </div>
            )}
          </div>
        </header>

        {agent.kind === 'xuewen' && (
          <XuewenForm
            value={formState as Partial<XuewenAgentConfig>}
            onChange={v => setFormState(v as Record<string, unknown>)}
          />
        )}
        {agent.kind === 'debate' && (
          <DebateForm
            value={formState as Partial<DebateAgentConfig>}
            onChange={v => setFormState(v as Record<string, unknown>)}
          />
        )}
        {agent.kind === 'discussion' && (
          <DiscussionForm
            value={formState as Partial<DiscussionAgentConfig>}
            onChange={v => setFormState(v as Record<string, unknown>)}
          />
        )}
      </main>
    </>
  );
}
