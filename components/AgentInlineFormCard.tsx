'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import { XuewenForm } from './AgentForm/Xuewen';
import { DebateForm } from './AgentForm/Debate';
import { DiscussionForm } from './AgentForm/Discussion';
import {
  type CreateKind,
  CREATE_KIND_LABEL,
  type XuewenAgentConfig,
  type DebateAgentConfig,
  type DiscussionAgentConfig,
} from '@/lib/agent-schemas';

type AnyConfig =
  | Partial<XuewenAgentConfig>
  | Partial<DebateAgentConfig>
  | Partial<DiscussionAgentConfig>;

interface Props {
  toolCallId: string;
  kind: CreateKind;
  initial: unknown; // tool 的 input — 已通过 schema 流式校验
}

const KIND_DOT_COLOR: Record<CreateKind, string> = {
  xuewen: 'var(--color-primary)',
  debate: 'var(--color-debate)',
  discussion: 'var(--color-discussion)',
};

export function AgentInlineFormCard({ toolCallId: _toolCallId, kind, initial }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [config, setConfig] = useState<AnyConfig>(initial as AnyConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  if (discarded) {
    return (
      <div
        className="rounded-md px-3 py-2 text-[12px]"
        style={{ background: 'var(--color-bg-gray)', color: 'var(--color-text-5)' }}
      >
        （已舍弃此草稿 · {CREATE_KIND_LABEL[kind]}）
      </div>
    );
  }

  async function handleSave() {
    const f = config as Record<string, unknown>;
    if (!f.name || !f.subject || !f.grade) {
      toast('「名称 / 学科 / 年级」必填');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, config }),
      });
      if (!res.ok) {
        toast('保存失败：服务暂不可用');
        return;
      }
      setSaved(true);
      toast(`已保存：${String(f.name)}`);
      setTimeout(() => router.push('/'), 700);
    } catch (e) {
      console.error(e);
      toast('保存失败：网络错误');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl border bg-white"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-3 text-[13px] font-semibold"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: KIND_DOT_COLOR[kind] }}
        />
        📝 {CREATE_KIND_LABEL[kind]} 草稿
        {saved && (
          <span
            className="ml-auto text-[11px] font-normal"
            style={{ color: 'var(--color-text-5)' }}
          >
            已保存
          </span>
        )}
      </div>

      <div className="p-4">
        {kind === 'xuewen' && (
          <XuewenForm
            value={config as Partial<XuewenAgentConfig>}
            onChange={v => !saved && setConfig(v)}
          />
        )}
        {kind === 'debate' && (
          <DebateForm
            value={config as Partial<DebateAgentConfig>}
            onChange={v => !saved && setConfig(v)}
          />
        )}
        {kind === 'discussion' && (
          <DiscussionForm
            value={config as Partial<DiscussionAgentConfig>}
            onChange={v => !saved && setConfig(v)}
          />
        )}
      </div>

      <div
        className="flex items-center justify-end gap-2 border-t px-4 py-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <button
          onClick={() => setDiscarded(true)}
          disabled={saving || saved}
          className="h-8 rounded-md px-3 text-[12px] disabled:opacity-50"
          style={{ color: 'var(--color-text-3)' }}
        >
          取消草稿
        </button>
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="h-8 rounded-md px-4 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'var(--color-primary)' }}
        >
          {saved ? '已保存' : saving ? '保存中…' : '确认保存'}
        </button>
      </div>
    </div>
  );
}
