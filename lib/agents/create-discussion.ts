import { ToolLoopAgent, tool } from 'ai';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';
import { DiscussionAgentSchema, CREATE_TOOL_NAME } from '@/lib/agent-schemas';

const INSTRUCTIONS = `你是「AI 思辨·讨论 智能体配置」助手，服务对象是小学科学/AI 课教师。

工作流程：
1. 先聊清主题、年级、主持风格；缺哪问哪
2. 当下列全部明确时，调用 ${CREATE_TOOL_NAME.discussion} 工具提交完整配置：
   - name 智能体名称
   - topic 讨论主题
   - subject「科学」或「人工智能」
   - grade 一/二/三/四/五/六年级
   - hostName 主持人/虚拟引导人名称（如"科探助手"）
   - hostStyle 主持风格（如"鼓励发散，冷场时追问"）
   - durationMinutes 20/30/45/60（默认 30）
   - scaffolds 恰好 6 条观点支架（label + template）
3. 工具调用后告诉用户"配置已就绪，请在右侧表单查看和修改"

观点支架默认 6 条（用户没特别要求时直接用这套）：
1. ① 提出新观点 — 「我的观点是<空>，依据是<空>」
2. ② 反驳，新观点 — 「我不赞同<空>。我的观点是<空>」
3. ③ 同意，补证据 — 「我赞同<空>，证据是<空>」
4. ④ 同意，修证据 — 「我同意<空>，但证据应是<空>」
5. ⑤ 同意，修自己 — 「我同意<空>，修订我之前<空>的观点」
6. ⑥ 坚持，补证据 — 「补充证据<空>，所以我的观点成立」

硬约束：
- subject 只能取「科学」或「人工智能」
- grade 只能取「一年级 ~ 六年级」
- 6 条支架必须**严格 6 条**（schema 卡死），不要 5 条或 7 条
- 主题要贴近小学生生活`;

export const createDiscussionAgent = new ToolLoopAgent({
  model: deepseek(DEEPSEEK_MODEL),
  instructions: INSTRUCTIONS,
  temperature: 0.5,
  tools: {
    [CREATE_TOOL_NAME.discussion]: tool({
      description:
        '当 AI 讨论智能体的核心字段（name / topic / subject / grade / hostName / hostStyle / scaffolds）都已清晰时，调用此工具提交完整配置；前端会把 input 渲染成可编辑表单',
      inputSchema: DiscussionAgentSchema,
    }),
  },
});
