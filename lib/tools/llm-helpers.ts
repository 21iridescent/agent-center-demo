import { tool, generateObject } from 'ai';
import { z } from 'zod';
import { deepseek, DEEPSEEK_MODEL } from '@/lib/deepseek';

/**
 * 学科助手工具集（LLM-as-tool）
 * 每个 tool 调一次同一模型 + 严格 zod schema → 结构化 JSON 返回。
 * 与 Exa 工具组合使用：先联网（事实层）→ 学科助手（教学法层）→ 拼成 markdown。
 *
 * 设计选择：
 * - 全部 generateObject，不用 streamObject —— execute 必须返回值不是流
 * - temperature ≤ 0.4 让结构稳定；schema 字段都 required（v6 推荐）
 */

const helperModel = deepseek.chat(DEEPSEEK_MODEL);

export const findMisconceptions = tool({
  description:
    '列出学生在某科学/AI 主题上常见的迷思概念（教育心理学 / 科学教育文献高频）。返回 3-5 条：错误想法 + 为什么持续 + 教师怎么引导。当生成教案/大纲需要写"重难点"时调用。',
  inputSchema: z.object({
    topic: z.string().describe('主题，如"光的反射"'),
    grade: z.string().describe('年级，如"三年级"'),
  }),
  execute: async ({ topic, grade }) => {
    const { object } = await generateObject({
      model: helperModel,
      schema: z.object({
        misconceptions: z
          .array(
            z.object({
              misconception: z.string(),
              why_it_persists: z.string(),
              how_to_address: z.string(),
            }),
          )
          .min(3)
          .max(5),
      }),
      prompt: `面向${grade}小学生在「${topic}」主题下，列出 3-5 个最常见的迷思概念。
每条给出：1) 学生的错误想法 2) 为什么这个错误会持续（认知/经验来源）3) 教师该如何引导。
基于科学教育文献的常识；不要编造冷门内容。`,
      temperature: 0.3,
    });
    return object.misconceptions;
  },
});

export const findAnalogy = tool({
  description:
    '给定一个抽象概念，生成适合年级的类比/比喻。返回 1-3 个：类比 + 概念到类比的映射 + 局限性。用于教案的"导入"或"难点突破"段。',
  inputSchema: z.object({
    concept: z.string().describe('抽象概念，如"电流"或"机器学习的训练"'),
    grade: z.string().describe('年级，如"四年级"'),
    num: z.number().int().min(1).max(3).optional().describe('返回类比数；默认 2'),
  }),
  execute: async ({ concept, grade, num = 2 }) => {
    const { object } = await generateObject({
      model: helperModel,
      schema: z.object({
        analogies: z
          .array(
            z.object({
              analogy: z.string(),
              mapping: z.string(),
              limitation: z.string(),
            }),
          )
          .min(1)
          .max(3),
      }),
      prompt: `面向${grade}小学生，给「${concept}」想 ${num} 个生活化、具象的类比。
每条给出：1) 类比本身 2) 概念到类比的映射（"X 对应 Y"）3) 这个类比的局限（在哪里会误导）。
用词浅显有比喻；不要套用"像花开了一样"这种模糊修辞。`,
      temperature: 0.4,
    });
    return object.analogies;
  },
});

export const generateRubric = tool({
  description:
    '给一条教学目标，生成三档评价量规（达成 / 部分达成 / 未达成）。每档给具体描述符。用于教案"评价"段或活动"评估标准"。',
  inputSchema: z.object({
    objective: z.string().describe('教学目标，如"学生能说出光的反射规律"'),
    grade: z.string().describe('年级'),
  }),
  execute: async ({ objective, grade }) => {
    const { object } = await generateObject({
      model: helperModel,
      schema: z.object({
        levels: z
          .array(
            z.object({
              label: z.enum(['达成', '部分达成', '未达成']),
              descriptors: z.array(z.string()).min(2).max(4),
            }),
          )
          .length(3),
      }),
      prompt: `给${grade}小学生的教学目标「${objective}」生成三档评价量规。
每档（达成 / 部分达成 / 未达成）给 2-4 条具体可观察的描述符。
描述符要可见可记录（如"能用箭头画出..."），不要空泛（如"理解了..."）。`,
      temperature: 0.3,
    });
    return object;
  },
});

export const materialsList = tool({
  description:
    '给定动手活动，输出每组材料 + 全班材料 + 替代品。用于活动方案的"材料清单"段。',
  inputSchema: z.object({
    activity: z.string().describe('活动名称或简要描述'),
    group_size: z.number().int().min(1).max(10).optional().describe('每组人数；默认 4'),
    total_groups: z.number().int().min(1).max(15).optional().describe('总组数；默认 8'),
  }),
  execute: async ({ activity, group_size = 4, total_groups = 8 }) => {
    const { object } = await generateObject({
      model: helperModel,
      schema: z.object({
        per_group: z
          .array(z.object({ name: z.string(), qty: z.string(), note: z.string() }))
          .min(1),
        whole_class: z
          .array(z.object({ name: z.string(), qty: z.string(), note: z.string() }))
          .min(0),
        substitutes: z
          .array(z.object({ original: z.string(), substitute: z.string() }))
          .min(0),
      }),
      prompt: `小学课堂活动「${activity}」。每组 ${group_size} 人，共 ${total_groups} 组。
列出：1) 每组材料（名称+数量+备注）2) 全班共用材料 3) 常见替代品（如缺乏 X 时用 Y）。
材料要在普通学校能拿到；不要列实验室级精密器材。`,
      temperature: 0.3,
    });
    return object;
  },
});

export const safetyWarnings = tool({
  description:
    '给定动手活动，输出风险点 + 严重程度 + 缓解措施。用于活动方案的"安全提示"段（强制必填）。',
  inputSchema: z.object({
    activity: z.string().describe('活动名称或简要描述'),
    grade: z.string().describe('年级（年级越低越严格）'),
  }),
  execute: async ({ activity, grade }) => {
    const { object } = await generateObject({
      model: helperModel,
      schema: z.object({
        warnings: z
          .array(
            z.object({
              risk: z.string(),
              severity: z.enum(['low', 'med', 'high']),
              mitigation: z.string(),
            }),
          )
          .min(1)
          .max(6),
      }),
      prompt: `${grade}小学生进行「${activity}」可能的安全风险。
列出 1-6 条：1) 风险描述 2) 严重程度 (low/med/high) 3) 缓解措施。
重点关注：尖锐物 / 高温 / 电 / 化学品 / 异物吸入 / 跌倒。低年级更严格。
没有任何风险时返 1 条 low + "无显著风险，常规课堂注意即可"。`,
      temperature: 0.2,
    });
    return object.warnings;
  },
});

export const timeBudget = tool({
  description:
    '把一节课的总时长拆成 4-6 个阶段。给每段：阶段名 / 分钟数 / 重点。用于教案/大纲的时间分配。',
  inputSchema: z.object({
    total_minutes: z.number().int().min(10).max(120).describe('总时长，分钟'),
    complexity: z.enum(['easy', 'normal', 'hard']).optional().describe('难度；默认 normal'),
  }),
  execute: async ({ total_minutes, complexity = 'normal' }) => {
    const { object } = await generateObject({
      model: helperModel,
      schema: z.object({
        phases: z
          .array(
            z.object({
              phase: z.string(),
              minutes: z.number().int().min(1),
              focus: z.string(),
            }),
          )
          .min(4)
          .max(6),
      }),
      prompt: `小学一节${total_minutes}分钟课，难度 ${complexity}，按"导入 / 新课讲授 / 动手探究 / 小结与延伸"拆 4-6 段。
每段给：阶段名、分钟数、重点。所有 minutes 加起来 = ${total_minutes}（误差 ±2 分钟）。
难度 hard 时讲授段更长、探究段加深；easy 反之。`,
      temperature: 0.3,
    });
    return object.phases;
  },
});

export const matchCurriculum = tool({
  description:
    '把主题对齐到课程标准（教科版 / 人教版 / 课标 2022）。返回标准 + 版本 + 学习目标 + 教学提示。用于教案"教学目标"段。',
  inputSchema: z.object({
    topic: z.string().describe('主题，如"光的反射"'),
    grade: z.string().describe('年级'),
    subject: z.string().describe('学科，如"科学"或"人工智能"'),
  }),
  execute: async ({ topic, grade, subject }) => {
    const { object } = await generateObject({
      model: helperModel,
      schema: z.object({
        standard: z.string(),
        version: z.string(),
        objectives: z.array(z.string()).min(2).max(5),
        hints: z.string(),
      }),
      prompt: `${grade}${subject}主题「${topic}」对应的课程标准。
给：1) 标准名（如《义务教育科学课程标准》）2) 版本（如 2022 修订版）3) 2-5 条学习目标 4) 教学提示。
基于公开常识；不确定的版本号要写"约"或"参考"，不要编造具体编号。`,
      temperature: 0.2,
    });
    return object;
  },
});

export const vocabularyList = tool({
  description:
    '给定主题，提取 3-12 个关键词汇 + 年级化解释 + 例句。用于教案"词汇"段或习题词汇预热。',
  inputSchema: z.object({
    topic: z.string().describe('主题'),
    grade: z.string().describe('年级'),
    max: z.number().int().min(3).max(12).optional().describe('词汇数；默认 6'),
  }),
  execute: async ({ topic, grade, max = 6 }) => {
    const { object } = await generateObject({
      model: helperModel,
      schema: z.object({
        terms: z
          .array(
            z.object({
              term: z.string(),
              plain_meaning: z.string(),
              example_sentence: z.string(),
            }),
          )
          .min(3)
          .max(12),
      }),
      prompt: `${grade}小学生学「${topic}」需要掌握的关键词汇，提 ${max} 条。
每条：1) 词汇 2) 浅显解释（不超过 30 字） 3) 例句（与生活相关）。
避免冷僻或同义重复；按学生认知顺序排列。`,
      temperature: 0.3,
    });
    return object.terms;
  },
});
