/**
 * 课程清单（demo 阶段静态种子）
 * 真课程服务上线后整体替换为 fetch；UI 不动
 *
 * 范围聚焦：小学科学 + AI 课程（per .planning 项目范围）
 */

export interface Course {
  id: string;
  title: string;
  subject: '科学' | '人工智能';
  grade: '一年级' | '二年级' | '三年级' | '四年级' | '五年级' | '六年级';
}

export const COURSE_SEEDS: Course[] = [
  { id: 'course-science-3-life',   title: '生命世界',     subject: '科学',     grade: '三年级' },
  { id: 'course-science-4-matter', title: '物质与能量',   subject: '科学',     grade: '四年级' },
  { id: 'course-science-5-earth',  title: '地球与宇宙',   subject: '科学',     grade: '五年级' },
  { id: 'course-science-6-tech',   title: '工程与技术',   subject: '科学',     grade: '六年级' },
  { id: 'course-ai-5-foundation',  title: 'AI 启蒙',      subject: '人工智能', grade: '五年级' },
  { id: 'course-ai-6-application', title: 'AI 应用入门',  subject: '人工智能', grade: '六年级' },
];

export function getCourseById(id: string | undefined): Course | undefined {
  if (!id) return undefined;
  return COURSE_SEEDS.find(c => c.id === id);
}
