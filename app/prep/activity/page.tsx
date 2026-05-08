import { PrepToolPage } from '@/components/PrepToolPage';

export default function Page() {
  return (
    <PrepToolPage
      toolName="课堂活动生成"
      kind="activity"
      contextFields={[
        { label: '教学目标', value: '认识简单电路' },
        { label: '学科', value: '科学' },
        { label: '年级', value: '四年级' },
      ]}
      saveTitleStem="简单电路"
      initialMessages={[
        {
          id: 'sys-greet',
          role: 'assistant',
          text: '你好，我是课堂活动生成助手。请告诉我教学目标、活动类型偏好（讨论 / 实验 / 游戏 等）和时长，我会生成具体的活动方案（含说明、分组、材料、评估标准）。',
        },
      ]}
    />
  );
}
