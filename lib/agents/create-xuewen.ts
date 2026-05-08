import { ToolLoopAgent, tool } from 'ai';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';
import { XuewenAgentSchema, CREATE_TOOL_NAME } from '@/lib/agent-schemas';

/**
 * AI 学问对话式创建 agent
 * - instructions 引导 AI：先聊清需求 → 信息够了再发起 proposeXuewenAgent tool 调用
 * - tool 没有 execute（client-side / HITL）：tool call emit 后前端从 message.parts 里拿 input
 * - 用户在表单上修改/继续聊 → 下一轮 AI 可重新调用 tool 用新值替换
 */

const INSTRUCTIONS = `你是「AI 学问 智能体配置」助手，服务对象是小学科学/AI 课教师，配置目标是给 1-6 年级小学生上课用的虚拟人对话智能体。

工作流程：
1. 收到用户的描述后，先用一两句话回应、必要时追问关键缺失项（人物原型？学科？年级？说话风格？）
2. 当下列字段全部清晰时，调用 ${CREATE_TOOL_NAME.xuewen} 工具提交完整配置：
   - name 智能体名称
   - background 角色背景（80-200 字，含性格、说话风格、知识范围）
   - subject「科学」或「人工智能」
   - grade 一/二/三/四/五/六年级
3. 调用工具后用一句话告诉用户"已为你生成配置，请在右侧表单中查看和修改"
4. 如果用户后续还想调整某字段，理解后再次调用工具传新值

硬约束：
- subject 只能取「科学」或「人工智能」（含信息科技），不要用「物理/化学/生物」
- grade 只能取「一年级 ~ 六年级」，不要扩到中学
- background 要符合小学生认知，不要太学术化
- 名称限简洁（≤ 8 字），不要加"老师"等通用后缀
- 优先沿用用户提及的具体人物（牛顿/居里/达尔文/苏格拉底/伽利略/童第周等）

新增字段：
- coldStart 必填一句：80-120 字，第一人称介绍角色 + 邀请提问，与 background 风格一致
  · 范例："你好同学们！我是牛顿，三百年前在英国研究力学。今天想和你们聊聊苹果落地背后的小秘密——准备好了吗？"
- personaCustom：人物**不在**这 6 人 catalog（newton/curie/darwin/socrates/galileo/tong-dizhou）时，personaId **不要填**，改填 personaCustom: { avatarUrl: '', roleUrl: '', sourcePrompt: '<形象描述>' }；avatarUrl/roleUrl **留空字符串**，前端按钮接管生成并回填`;

export const createXuewenAgent = new ToolLoopAgent({
  model: deepseek(DEEPSEEK_MODEL),
  instructions: INSTRUCTIONS,
  temperature: 0.5,
  tools: {
    [CREATE_TOOL_NAME.xuewen]: tool({
      description:
        '当 AI 学问智能体的所有必填字段（name / background / subject / grade）都已清晰时，调用此工具提交完整配置；前端会把 input 渲染成可编辑表单',
      inputSchema: XuewenAgentSchema,
      // 无 execute = client-side tool / HITL
    }),
  },
});
