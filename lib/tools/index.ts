/**
 * 备课 agent 工具集 barrel + 每个 agent 的子集
 *
 * 工具 key 名（如 `webSearch`）就是 UIMessage parts 里出现的 `tool-{key}` 名，
 * ChatArea 的 PREP_TOOL_LABELS 必须用同样的 camelCase。
 *
 * v2（artifact-first）：
 * - 砍掉所有"LLM 假装是 tool"的助手（findMisconceptions / findAnalogy / matchCurriculum /
 *   timeBudget / vocabularyList / generateRubric / materialsList / safetyWarnings /
 *   generateMermaid / calculator / unitConvert）—— 这类工具不带来新信息，只是把生成切片
 * - 只保留：真联网（webSearch/crawlUrl/findSimilar）+ writeCanvas
 * - writeCanvas 是 artifact-first 范式的关键：AI 搜完资料就调它把成稿写入 canvas，
 *   chat 流程不再 dump 整稿
 */

export * from './exa';
export * from './canvas';

// 旧的 LLM helpers / diagrams / utils 文件保留，但本期不接入任何 agent；
// 想恢复某条只需要在下方 import + 把它加回某个 *_TOOLS。

import { webSearch, crawlUrl, findSimilar } from './exa';
import { writeCanvas, editCanvas } from './canvas';

/**
 * 全部 5 个备课 agent 共用同一组 tools —— 因为 flow 是一致的：
 *   web_search → (可选 crawl_url) → writeCanvas → 后续修改用 editCanvas（pending Apply/Cancel）
 * 差异在 system prompt（产物结构）而非工具集。
 */
const PREP_TOOL_BUNDLE = {
  webSearch,
  crawlUrl,
  findSimilar,
  writeCanvas,
  editCanvas,
} as const;

export const OUTLINE_TOOLS = PREP_TOOL_BUNDLE;
export const LESSON_TOOLS = PREP_TOOL_BUNDLE;
export const EXERCISE_TOOLS = PREP_TOOL_BUNDLE;
export const ACTIVITY_TOOLS = PREP_TOOL_BUNDLE;
export const PROJECT_TOOLS = PREP_TOOL_BUNDLE;
