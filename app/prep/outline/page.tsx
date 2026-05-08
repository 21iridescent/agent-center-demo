import { PrepToolPage } from '@/components/PrepToolPage';

export default function Page() {
  return (
    <PrepToolPage
      toolName="课件大纲规划"
      kind="outline"
      contextFields={[
        { label: '课题', value: '水的三态变化' },
        { label: '学科', value: '科学' },
        { label: '年级', value: '三年级' },
      ]}
      saveTitleStem="水的三态变化"
      initialMessages={[
        {
          id: 'sys-greet',
          role: 'assistant',
          text: '你好，我是课件大纲规划助手。请告诉我你要规划的课题、年级和学科，我会帮你生成一份完整的课件大纲，并支持反复修改。',
        },
      ]}
    />
  );
}
