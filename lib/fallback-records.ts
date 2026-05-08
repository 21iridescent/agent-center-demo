import type { UIMessage } from 'ai';
import type { AppRecord } from './types';

/**
 * 12 条预置记录——demo 厚度兜底，未与远端 KV 重复
 * 远端记录会拼到这些之前
 */
export const FALLBACK_RECORDS: AppRecord[] = [
  {
    id: 'p1',
    type: 'prep',
    kind: 'outline',
    title: '水的三态变化课件大纲',
    summary: '导入/讲授/动手实验/小结 · 4 环节 · 总 40 分钟',
    time: '2026-05-08 16:00 · 今天',
    createdAt: '2026-05-08T16:00:00Z',
    agentName: '课件大纲规划',
    avatar: '课',
    meta: { 学科: '科学', 年级: '三年级' },
  },
  {
    id: 'p2',
    type: 'prep',
    kind: 'lesson',
    title: '三年级动物分类教案',
    summary: '教学目标 / 重难点 / 活动安排 / 作业设计',
    time: '2026-05-07 10:30 · 昨天',
    createdAt: '2026-05-07T10:30:00Z',
    agentName: '教学设计助手',
    avatar: '案',
    meta: { 学科: '科学', 年级: '三年级' },
  },
  {
    id: 'p3',
    type: 'prep',
    kind: 'exercise',
    title: '二年级磁铁练习题（10 题）',
    summary: '选择 6 · 判断 2 · 简答 2 · 含答案与解析',
    time: '2026-05-05 14:20 · 3 天前',
    createdAt: '2026-05-05T14:20:00Z',
    agentName: '习题智能出题',
    avatar: '题',
    meta: { 学科: '科学', 年级: '二年级' },
  },
  {
    id: 'p4',
    type: 'prep',
    kind: 'activity',
    title: '四年级简单电路课堂活动方案',
    summary: '分组实验 · 观察记录单 · 评估标准',
    time: '2026-05-02 09:15 · 上周',
    createdAt: '2026-05-02T09:15:00Z',
    agentName: '课堂活动生成',
    avatar: '动',
    meta: { 学科: '科学', 年级: '四年级' },
  },
  {
    id: 'r1',
    type: 'dialogue',
    title: '牛顿',
    summary: '最后一问：苹果为什么会从树上落下？',
    time: '2026-04-29 14:30 · 今天',
    createdAt: '2026-04-29T14:30:00Z',
    avatar: 'N',
    avatarUrl: '/assets/generated/xuewen-avatar-newton.png',
    turns: 3,
    meta: {
      personaId: 'newton',
      subject: '科学',
      grade: '四年级',
      background: '英国物理学家、数学家，发现万有引力与运动三定律。说话沉稳、爱用生活中的小例子（苹果、月亮、马车）解释物理。',
    },
    transcript: {
      messages: [
        {
          id: 'r1-m1',
          role: 'assistant',
          parts: [{ type: 'text', text: '你好！我是牛顿。你想跟我聊点什么？' }],
        },
        {
          id: 'r1-m2',
          role: 'user',
          parts: [{ type: 'text', text: '苹果为什么会从树上落下？' }],
        },
        {
          id: 'r1-m3',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text:
                '这是个让我琢磨了好一阵子的问题——其实，地球上每一样东西都被一种看不见的"拉力"往下拽，' +
                '我们叫它"重力"。苹果的茎不再撑得住的时候，这股拉力就把它带回地面。' +
                '更妙的是，让月亮绕着我们转的也是同一种力，只是月亮跑得够快，才没掉下来。',
            },
          ],
        },
        {
          id: 'r1-m4',
          role: 'user',
          parts: [{ type: 'text', text: '那为什么月亮没有掉下来？' }],
        },
        {
          id: 'r1-m5',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text:
                '想象你拿一根绳子甩石头转圈：石头一直在被绳子往里拉，可它跑得够快，就一直绕着你转，掉不下来。' +
                '月亮跟我们也是这样——重力是那根"看不见的绳子"，月亮的速度让它一边被拉、一边一直往前跑，' +
                '于是就成了我们头顶的圆环。',
            },
          ],
        },
      ] as UIMessage[],
    },
  },
  {
    id: 'r2',
    type: 'dialogue',
    title: '居里夫人',
    summary: '最后一问：放射性元素是怎么被你发现的？',
    time: '2026-04-28 16:20 · 昨天',
    createdAt: '2026-04-28T16:20:00Z',
    avatar: 'M',
    turns: 8,
  },
  {
    id: 'r3',
    type: 'debate',
    title: '一次性塑料袋是否应禁用',
    summary: '正方 2 段 · 反方 2 段 · AI 评委综合评分 7.2',
    time: '2026-04-26 10:15 · 3 天前',
    createdAt: '2026-04-26T10:15:00Z',
    avatar: '辩',
    avatarUrl: '/assets/generated/debate-avatar-judge.png',
    pro: 2, con: 2, score: 7.2,
    agentName: '塑料禁令辩论',
    meta: {
      proActorId: 'pro-ai',
      conActorId: 'con-student',
      thumbAsset: 'plastic-ocean',
      bgAsset: 'stage-balanced',
      subject: '科学',
      grade: '六年级',
      totalRounds: '2',
    },
    transcript: {
      history: [
        {
          round: 1,
          side: 'pro',
          text:
            '一次性塑料袋应当禁用。它在自然中需要数百年才能降解，海洋里漂浮的塑料碎片已经进入了鱼虾的肚子，' +
            '最终又回到我们的餐桌。与其等污染失控再补救，不如从源头限用。',
        },
        {
          round: 1,
          side: 'con',
          text:
            '完全禁用过于一刀切。许多家庭依赖一次性袋子保鲜剩菜、装垃圾；老人和小摊贩短期内换不了昂贵替代品。' +
            '更合理的是推广可降解材料、收回收押金，而不是粗暴禁止。',
        },
        {
          round: 2,
          side: 'pro',
          text:
            '可降解材料目前普及率不到一成，多数所谓"环保袋"工业堆肥才能降解，普通垃圾桶里照样几十年不化。' +
            '没有禁令，市场没有动力去推动真替代品。',
        },
        {
          round: 2,
          side: 'con',
          text:
            '禁令推得太快，反而让大家偷偷用、用得更凶。配套的回收点、押金返还、可降解袋补贴一步步铺开，' +
            '让家长和小店主自己愿意换，比一禁了之走得远。',
        },
      ],
      judgeText:
        '【双方论点小结】\n' +
        '正方强调一次性塑料袋污染严重、自然降解慢、可降解替代品普及不足，主张通过禁令倒逼市场转型。\n' +
        '反方认为一刀切忽视普通家庭与小摊贩的现实需求，应通过回收体系与替代品补贴循序渐进。\n\n' +
        '【亮点】\n' +
        '正方：用"鱼虾肚子里的塑料"把抽象污染具象化；指出"无禁令则无市场动力"，逻辑闭环清晰。\n' +
        '反方：从"老人与小摊贩"切入弱势群体处境；提出回收押金这一可执行替代方案。\n\n' +
        '【可改进】\n' +
        '正方：缺少对"如何过渡"的具体方案，容易显得理想化。\n' +
        '反方：未正面回应"塑料降解需要数百年"的核心数据。\n\n' +
        '【综合点评】\n' +
        '双方都从生活实际出发，证据扎实、措辞克制。如果再多一些彼此追问的细节，会更精彩。',
      score: 7.2,
    },
  },
  {
    id: 'r4',
    type: 'discussion',
    title: '如何改善班级气候',
    summary: '6 个观点支架已使用 · 28 条学生发言',
    time: '2026-04-22 14:05 · 上周',
    createdAt: '2026-04-22T14:05:00Z',
    avatar: '讨',
    speeches: 28, scaffolds: 6,
    agentName: '班级讨论助手',
  },
  {
    id: 'r5',
    type: 'dialogue',
    title: '通用 AI 学问',
    summary: '最后一问：声音是怎么传到我们耳朵的？',
    time: '2026-04-20 09:30 · 上周',
    createdAt: '2026-04-20T09:30:00Z',
    avatar: '学',
    turns: 5,
  },
  {
    id: 'r6',
    type: 'debate',
    title: '小学生该不该使用 AI 助手做作业',
    summary: '正方 4 轮 · 反方 5 轮 · AI 评委综合评分 6.8',
    time: '2026-04-12 11:40 · 上月',
    createdAt: '2026-04-12T11:40:00Z',
    avatar: '辩',
    pro: 4, con: 5, score: 6.8,
    agentName: 'AI 作业辩论',
  },
  {
    id: 'r7',
    type: 'dialogue',
    title: '达尔文',
    summary: '最后一问：动物是怎么慢慢变化的？',
    time: '2026-04-08 15:50 · 上月',
    createdAt: '2026-04-08T15:50:00Z',
    avatar: 'D',
    turns: 9,
  },
  {
    id: 'r8',
    type: 'discussion',
    title: '塑料垃圾如何处理',
    summary: '6 个观点支架已使用 · 24 条学生发言',
    time: '2026-04-05 10:00 · 2 周前',
    createdAt: '2026-04-05T10:00:00Z',
    avatar: '讨',
    speeches: 24, scaffolds: 6,
    agentName: '环保讨论助手',
  },
];
