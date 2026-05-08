import { PrepToolPage } from '@/components/PrepToolPage';

export default function Page() {
  return (
    <PrepToolPage
      toolName="教学设计助手"
      kind="lesson"
      contextFields={[
        { label: '课题', value: '光的反射' },
        { label: '学科', value: '科学' },
        { label: '年级', value: '三年级' },
      ]}
      saveTitleStem="光的反射"
      initialMessages={[
        {
          id: 'sys-greet',
          role: 'assistant',
          text: '你好，我是教学设计助手。我会根据课题、学情和教学目标，帮你生成一份完整教案（教学目标 / 重难点 / 教学过程 / 板书 / 作业设计）。',
        },
      ]}
    />
  );
}
