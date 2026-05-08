import { PrepToolPage } from '@/components/PrepToolPage';

export default function Page() {
  return (
    <PrepToolPage
      toolName="习题智能出题"
      kind="exercise"
      contextFields={[
        { label: '知识点', value: '磁铁的两极' },
        { label: '学科', value: '科学' },
        { label: '年级', value: '二年级' },
      ]}
      saveTitleStem="磁铁的两极"
      initialMessages={[
        {
          id: 'sys-greet',
          role: 'assistant',
          text: '你好，我是习题智能出题助手。请告诉我知识点、年级、题量和题型分布，我会生成对应的练习题（含答案与解析）。',
        },
      ]}
    />
  );
}
