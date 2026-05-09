import { PrepToolPage } from '@/components/PrepToolPage';

export default function Page() {
  return (
    <PrepToolPage
      toolName="项目化学习设计"
      kind="project"
      contextFields={[
        { label: '主题',   value: '校园塑料消减' },
        { label: '学科',   value: '科学' },
        { label: '年级',   value: '六年级' },
        { label: '课时数', value: '6 课时（约 3 周）' },
      ]}
      saveTitleStem="校园塑料消减"
      initialMessages={[
        {
          id: 'sys-greet',
          role: 'assistant',
          text: '你好，我是项目化学习设计助手。请告诉我你要做的项目主题、年级、跨多少课时——我会帮你规划驱动性问题、阶段拆分、评价量规和家校协同方案。',
        },
      ]}
    />
  );
}
