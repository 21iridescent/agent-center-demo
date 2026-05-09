/**
 * 课程清单（demo 阶段静态种子）
 * 真课程服务上线后整体替换为 fetch；UI 不动
 *
 * 范围：小学科学 + 人工智能（per .planning 项目范围）
 *
 * 三级层级：
 *   年级（grade） → 单元（CourseUnit） → 课程（Course）
 *
 * `linkedCourseId` 始终指向叶子课程（Course.id），不指向单元。
 * 旧扁平时代的 6 个 id 升格为单元 id，新课程 id 加 `-l{n}` 后缀。
 */

export type Subject = '科学' | '人工智能';
export type Grade =
  | '一年级'
  | '二年级'
  | '三年级'
  | '四年级'
  | '五年级'
  | '六年级';

export interface Course {
  id: string;
  title: string;
  subject: Subject;
  grade: Grade;
  /** 所属单元 id（CourseUnit.id） */
  unitId: string;
  /** 所属单元名（冗余，便于 label 渲染） */
  unit: string;
}

export interface CourseUnit {
  id: string;
  title: string;
  subject: Subject;
  grade: Grade;
  courses: Omit<Course, 'unitId' | 'unit' | 'subject' | 'grade'>[];
}

/* ───────────────────────────────────────────────────────────────
   单元树（demo 种子）
   - 6 个旧 id 保留为单元 id，避免老引用全部失联
   - 每个单元 2-4 节课；总数控制在 ~22 节，够 demo
   ─────────────────────────────────────────────────────────────── */

const UNITS_RAW: CourseUnit[] = [
  // ── 科学 · 三年级 ──────────────────────────
  {
    id: 'course-science-3-life',
    title: '生命世界',
    subject: '科学',
    grade: '三年级',
    courses: [
      { id: 'course-science-3-life-l1', title: '植物的生长' },
      { id: 'course-science-3-life-l2', title: '植物的叶' },
      { id: 'course-science-3-life-l3', title: '动物的一生' },
    ],
  },
  // ── 科学 · 四年级 ──────────────────────────
  {
    id: 'course-science-4-matter',
    title: '物质与能量',
    subject: '科学',
    grade: '四年级',
    courses: [
      { id: 'course-science-4-matter-l1', title: '声音的产生' },
      { id: 'course-science-4-matter-l2', title: '声音的传播' },
      { id: 'course-science-4-matter-l3', title: '简单电路' },
      { id: 'course-science-4-matter-l4', title: '导体与绝缘体' },
    ],
  },
  // ── 科学 · 五年级 ──────────────────────────
  {
    id: 'course-science-5-earth',
    title: '地球与宇宙',
    subject: '科学',
    grade: '五年级',
    courses: [
      { id: 'course-science-5-earth-l1', title: '地球的结构' },
      { id: 'course-science-5-earth-l2', title: '月相变化' },
      { id: 'course-science-5-earth-l3', title: '日食与月食' },
    ],
  },
  // ── 科学 · 六年级 ──────────────────────────
  {
    id: 'course-science-6-tech',
    title: '工程与技术',
    subject: '科学',
    grade: '六年级',
    courses: [
      { id: 'course-science-6-tech-l1', title: '工具与简单机械' },
      { id: 'course-science-6-tech-l2', title: '杠杆与轮轴' },
      { id: 'course-science-6-tech-l3', title: '设计与制作' },
    ],
  },
  // ── 人工智能 · 五年级 ──────────────────────
  {
    id: 'course-ai-5-foundation',
    title: 'AI 启蒙',
    subject: '人工智能',
    grade: '五年级',
    courses: [
      { id: 'course-ai-5-foundation-l1', title: '什么是人工智能' },
      { id: 'course-ai-5-foundation-l2', title: '数据与训练' },
      { id: 'course-ai-5-foundation-l3', title: 'AI 与生活' },
    ],
  },
  // ── 人工智能 · 六年级 ──────────────────────
  {
    id: 'course-ai-6-application',
    title: 'AI 应用入门',
    subject: '人工智能',
    grade: '六年级',
    courses: [
      { id: 'course-ai-6-application-l1', title: '图像识别' },
      { id: 'course-ai-6-application-l2', title: '语音识别' },
      { id: 'course-ai-6-application-l3', title: 'AI 伦理与社会' },
    ],
  },
];

export const COURSE_UNITS: CourseUnit[] = UNITS_RAW;

/** 扁平课程列表（向后兼容旧 import） */
export const COURSE_SEEDS: Course[] = UNITS_RAW.flatMap(u =>
  u.courses.map(c => ({
    ...c,
    unitId: u.id,
    unit: u.title,
    subject: u.subject,
    grade: u.grade,
  })),
);

/* ───────────────────────────────────────────────────────────────
   查询 helper
   ─────────────────────────────────────────────────────────────── */

export function getCourseById(id: string | undefined): Course | undefined {
  if (!id) return undefined;
  return COURSE_SEEDS.find(c => c.id === id);
}

export function getUnitById(id: string | undefined): CourseUnit | undefined {
  if (!id) return undefined;
  return COURSE_UNITS.find(u => u.id === id);
}

/**
 * 把 linkedCourseId 渲染成「年级 · 单元 · 课程」标签
 *
 * 兼容三种输入：
 *   - 课程 id：返回 "三年级 · 生命世界 · 植物的生长"
 *   - 单元 id（旧扁平时代遗留）：返回 "三年级 · 生命世界"
 *   - 未知 id：返回 undefined
 */
export function getCourseLabel(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const c = getCourseById(id);
  if (c) return `${c.grade} · ${c.unit} · ${c.title}`;
  const u = getUnitById(id);
  if (u) return `${u.grade} · ${u.title}`;
  return undefined;
}
