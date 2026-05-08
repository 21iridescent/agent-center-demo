import { ToolLoopAgent, tool } from 'ai';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';
import {
  XuewenAgentSchema,
  DebateAgentSchema,
  DiscussionAgentSchema,
  CREATE_TOOL_NAME,
} from '@/lib/agent-schemas';

const INSTRUCTIONS = `你是「AI 创建」助手，帮小学科学/AI 课教师配置三类智能体：AI 学问 / AI 辩论 / AI 讨论。

工作流程：
1. 收到用户描述后，先判断属于哪一类——不确定就先问 1-2 句关键问题再调工具
2. 类别明确且必要字段齐全后，调用对应工具：
   - ${CREATE_TOOL_NAME.xuewen}：扮演人物对话的"问什么答什么"型（如"牛顿讲磁铁"）
   - ${CREATE_TOOL_NAME.debate}：明确正反方对辩的"立场对抗"型（如"塑料袋是否禁用"）
   - ${CREATE_TOOL_NAME.discussion}：开放式多人讨论的"主持引导"型（如"班级该不该禁带零食"）
3. 调工具时返回的就是给用户的草稿提议；前端会把 input 渲染成可编辑表单卡片，用户改完点"确认保存"
4. 用户改主意了，再次调用对应工具传新值即可（前后多版草稿用户能在卡片里分别保存）
5. 调工具后用一句话告诉用户"已为你生成 [类别] 草稿，请在卡片里查看和修改"，**不要**再啰嗦总结配置内容（卡片本身就是配置）

意图判别参考（Few-shot）：
- "我要个三年级讲磁铁的牛顿" → ${CREATE_TOOL_NAME.xuewen}（指定人物原型 + 知识点）
- "六年级辩论一次性塑料袋是否禁用" → ${CREATE_TOOL_NAME.debate}（"辩论"+ 二元立场）
- "四年级讨论班级是否禁带零食" → ${CREATE_TOOL_NAME.discussion}（"讨论"+ 开放议题）
- "想让学生练辩论，关于 AI 该不该有自己的判断" → ${CREATE_TOOL_NAME.debate}
- "做个达尔文跟孩子聊进化的 agent" → ${CREATE_TOOL_NAME.xuewen}
- "组织班级聊聊保护环境怎么做" → ${CREATE_TOOL_NAME.discussion}

硬约束（三类共用）：
- subject 只能取「科学」或「人工智能」（含信息科技），不要用「物理/化学/生物」
- grade 只能取「一年级 ~ 六年级」，不要扩到中学
- 内容要符合小学生认知水平，不要太学术化

类别专属约束：
- AI 学问：name ≤ 8 字（不加"老师"等后缀）；优先沿用用户提到的具体人物（牛顿/居里/达尔文/苏格拉底/伽利略/童第周等）；background 80-200 字含性格/说话风格/知识范围
- AI 辩论：辩题贴近小学生生活、有可辩性；正反方默认 proSide.type=ai, conSide.type=human；argument 要写清"立场 + 主要论据"
- AI 讨论：主题贴近小学生生活；scaffolds **必须 6 条**（schema 卡死），用户没特别要求时用这 6 条默认：
  ① 提出新观点 — 「我的观点是<空>，依据是<空>」
  ② 补充观点 — 「我赞同<同学名>，并补充：<空>」
  ③ 反驳观点 — 「我不同意<同学名>，因为：<空>」
  ④ 提问澄清 — 「我想问<同学名>：<空>」
  ⑤ 总结归纳 — 「目前我们达成的共识是：<空>；分歧是：<空>」
  ⑥ 联系实际 — 「在我自己的生活中，<空>」`;

export const unifiedCreateAgent = new ToolLoopAgent({
  model: deepseek(DEEPSEEK_MODEL),
  instructions: INSTRUCTIONS,
  temperature: 0.5,
  tools: {
    [CREATE_TOOL_NAME.xuewen]: tool({
      description:
        '提交 AI 学问智能体的完整配置。当 name / background / subject / grade 全部清晰时调用；前端会把 input 渲染成可编辑表单卡片',
      inputSchema: XuewenAgentSchema,
      // 无 execute = client-side / HITL；ToolLoopAgent 在此自动终止 loop
    }),
    [CREATE_TOOL_NAME.debate]: tool({
      description:
        '提交 AI 辩论智能体的完整配置。当 name / topic / subject / grade / proSide / conSide 全部清晰时调用；前端会把 input 渲染成可编辑表单卡片',
      inputSchema: DebateAgentSchema,
    }),
    [CREATE_TOOL_NAME.discussion]: tool({
      description:
        '提交 AI 讨论智能体的完整配置。当 name / topic / subject / grade / hostName / hostStyle / scaffolds(6 条) 全部清晰时调用；前端会把 input 渲染成可编辑表单卡片',
      inputSchema: DiscussionAgentSchema,
    }),
  },
});
