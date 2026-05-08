@AGENTS.md

## Design Context

> 本节是项目所有视觉/交互决策的源头。完整版：`.impeccable.md`。这里是供任何 Claude 会话开箱即读的精简版。

### Users
小学科学 / 人工智能课程一线老师。**双场景，各占一半**：桌面备课（一个人、长时间、密度高、近距离）+ 教室投影（讲台 + 大屏 + 学生围观、2–3m 距离）。

### Brand Personality
**温暖、考究、像翻得卷边的备课笔记。** 不是 AI 产品、不是企业后台、不是儿童玩具——是教师休息室里那本被翻旧的工作册。

### Aesthetic Direction
- **Theme:** Light only。`prefers-color-scheme: dark` 强制 light，遵守。
- **Material metaphor:** 纸（档案册 / 手账 / 教科书内页 / 文件分页卡）。
- **Anti-references（锁死）:** Ant/Element/Arco/TDesign 国产后台模板；Notion/Linear/Vercel 硅谷极简灰白；儿童卡通配色；AI 玩具感（霓虹/光晕/渐变文本）。
- **Typography 拒绝清单:** Inter / Roboto / Fraunces / Newsreader / Syne / DM Sans / Plus Jakarta / Instrument Sans；以及"思源黑体单飞"的现状。
- **Color stance:** 保留学问蓝 `#368FFF` / 辩论红 `#F53B3B` / 讨论青 `#00A9F9` 三类型语义骨架；中性色全部重写为 OKLCH 偏暖纸调（朝米黄/赭微偏 chroma 0.005–0.01）。

### Design Principles
1. **Paper over chrome** — 用栏宽、版口、栏线、章节号、侧栏标签分层；少用 shadow+圆角+gradient。
2. **Editorial hierarchy beats card uniformity** — 备课/授课/评价三段允许密度和重心不一样；不要"四等大卡片连刷三屏"。
3. **Three brand colors are tools, not decoration** — 学问蓝/辩论红/讨论青**只**用在与"类型"严格绑定处；装饰元素走中性纸调。
4. **Typography is the brand** — 字体对（中文 display + 中文 body + 西文/数字）承担品牌识别。
5. **1m projector + 30cm desk test** — 任何字号/对比/间距决策都要同时通过这两个距离测试。
