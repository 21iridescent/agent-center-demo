/**
 * canvas editCanvas 工具的 find/replace 在 source 里的定位逻辑。
 *
 * 直接 `source.indexOf(find)` 经常失败 —— AI 写出来的 find 字符串和 canvas 实际 source
 * 之间常有微小空白差异：
 *   - 行尾多/少一个空格（`** ` vs `**`）
 *   - 段落间空行数量不同（一个换行 vs 两个）
 *   - 多个空格被合并成一个
 *
 * 这个文件给一套：
 *   1. exact match 优先
 *   2. 失败 → 把 source 和 find 都做空白归一化（保留语义，吃掉差异）
 *   3. 在归一化字符串里找位置 → 通过 index map 反算回原 source 的字符位置
 *
 * 替换时用反算出的位置切片，能保留 source 原始空白；不会副作用扰动其它部分。
 */

export interface MatchPosition {
  /** 命中起始字符在 source 里的下标（含） */
  start: number;
  /** 命中结束字符在 source 里的下标（不含；可直接 source.slice(start, end) 取） */
  end: number;
  /** 是否走的 fuzzy（归一化后才匹配）—— UI 可据此打"近似匹配"标记 */
  fuzzy: boolean;
}

/** editCanvas 工具的两种锚定方式 —— 与 lib/tools/canvas.ts 的 inputSchema 同步 */
export type AnchorType = 'exact' | 'section';

/**
 * 在 source 里定位一段 find（可能模糊）。找不到返 null。
 * 调用方可以：source.slice(0, pos.start) + replace + source.slice(pos.end)
 *
 * - 'exact'   : find 必须是 source 里的精确（或归一化后等价）子串
 * - 'section' : find 是一行 heading（如 "## 一、课前导入"），
 *               匹配 [该 heading → 下一同级或更高级 heading) 的整节区间。
 */
export function findEditPosition(
  source: string,
  find: string,
  anchorType: AnchorType = 'exact',
): MatchPosition | null {
  if (!find) return null;
  if (anchorType === 'section') {
    return findSectionPosition(source, find);
  }

  // exact 模式 —— 1. 精确匹配
  const exact = source.indexOf(find);
  if (exact >= 0) {
    return { start: exact, end: exact + find.length, fuzzy: false };
  }

  // 2. 归一化后匹配
  const ns = normalizeWithMap(source);
  const nf = normalizeWithMap(find);
  if (!nf.norm) return null;

  const idx = ns.norm.indexOf(nf.norm);
  if (idx < 0) return null;

  const start = ns.map[idx];
  const lastNormCharIdx = idx + nf.norm.length - 1;
  const lastSrcIdx = ns.map[lastNormCharIdx];
  // end 是不含位置；在 source 里指向匹配尾字符之后
  return { start, end: lastSrcIdx + 1, fuzzy: true };
}

/**
 * Section 模式定位：find 是一行 heading（如 "## 一、课前导入（5 分钟）"），
 * 在 source 里找到该 heading 所在行 → 区间到下一个同级或更高级 heading 为止
 * （或文档末尾）。
 *
 * AI 调 editCanvas + anchorType='section' 时，只要 verbatim 抄 heading 行，
 * 整节正文怎么变都能定位 —— 比抄整段几百字鲁棒得多。
 *
 * 找不到 heading 行返 null。
 */
function findSectionPosition(source: string, headingFind: string): MatchPosition | null {
  // find 里第一个非空白行假定是 heading
  const headingLine = headingFind.split('\n').map(l => l.trim()).find(Boolean) ?? '';
  const m = headingLine.match(/^(#{1,6})\s+/);
  if (!m) return null;
  const level = m[1].length;

  // 在 source 里找这行 heading（先精确，后归一化空白）
  const lineStart = findLineStart(source, headingLine);
  if (lineStart < 0) return null;

  // 区间结束：从该 heading 行末之后开始，找下一个 #{1..level} 开头的行
  const headingLineEnd = source.indexOf('\n', lineStart);
  const searchFrom = headingLineEnd < 0 ? source.length : headingLineEnd + 1;
  const nextHeading = findNextHeadingOfLevel(source, searchFrom, level);
  const end = nextHeading < 0 ? source.length : nextHeading;
  return { start: lineStart, end, fuzzy: false };
}

/** 在 source 里查找一整行 = headingLine 的起始位置（先精确，后归一化空白）。找不到 -1。 */
function findLineStart(source: string, headingLine: string): number {
  // 精确：行首匹配
  let cursor = 0;
  while (cursor < source.length) {
    const lineEnd = source.indexOf('\n', cursor);
    const line = source.slice(cursor, lineEnd < 0 ? source.length : lineEnd);
    if (line === headingLine || line.trim() === headingLine.trim()) {
      return cursor;
    }
    if (lineEnd < 0) break;
    cursor = lineEnd + 1;
  }
  return -1;
}

/** 从 fromIdx 起找下一个 1..maxLevel 级 heading 的行起始位置；没有则 -1。 */
function findNextHeadingOfLevel(source: string, fromIdx: number, maxLevel: number): number {
  let cursor = fromIdx;
  while (cursor < source.length) {
    const lineEnd = source.indexOf('\n', cursor);
    const line = source.slice(cursor, lineEnd < 0 ? source.length : lineEnd);
    const m = line.match(/^(#{1,6})\s+/);
    if (m && m[1].length <= maxLevel) {
      return cursor;
    }
    if (lineEnd < 0) break;
    cursor = lineEnd + 1;
  }
  return -1;
}

/**
 * 应用一条 find/replace。找不到返 { matched: false } + 原文不动。
 */
export function applyEdit(
  source: string,
  find: string,
  replace: string,
  anchorType: AnchorType = 'exact',
): { md: string; matched: boolean; fuzzy: boolean } {
  const pos = findEditPosition(source, find, anchorType);
  if (!pos) return { md: source, matched: false, fuzzy: false };
  return {
    md: source.slice(0, pos.start) + replace + source.slice(pos.end),
    matched: true,
    fuzzy: pos.fuzzy,
  };
}

/**
 * 数 find 在 source 里出现几次（exact + fuzzy 各算一次类）：
 *   - 优先精确匹配；若有精确匹配，返回精确匹配次数（不混进 fuzzy）
 *   - 精确匹配 0 次时，回退到归一化后匹配，返回该次数
 *
 * Anthropic Edit 风格的"唯一性强制"用：== 1 才允许 apply；== 0 → not found；> 1 → ambiguous。
 */
export function countMatches(source: string, find: string): number {
  if (!source || !find) return 0;
  // exact
  let count = 0;
  let idx = 0;
  while (true) {
    const found = source.indexOf(find, idx);
    if (found < 0) break;
    count++;
    idx = found + find.length;
  }
  if (count > 0) return count;
  // fuzzy
  const ns = normalizeWithMap(source);
  const nf = normalizeWithMap(find);
  if (!nf.norm) return 0;
  let fcount = 0;
  let fidx = 0;
  while (true) {
    const found = ns.norm.indexOf(nf.norm, fidx);
    if (found < 0) break;
    fcount++;
    fidx = found + nf.norm.length;
  }
  return fcount;
}

/**
 * 抽出 source 中所有的 markdown heading 行（trim 后），用于失败时反馈给 AI ——
 * AI 看到 "canvas 当前的 heading 列表" 后能精确定位下一次 editCanvas 应该用什么 find。
 */
export function extractHeadings(source: string): string[] {
  if (!source) return [];
  const out: string[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (/^#{1,6}\s+/.test(line)) out.push(line);
  }
  return out;
}

/**
 * 字符串归一化 + 字符级 index map
 *
 * 归一化规则（保留语义、吃掉空白差异）：
 *   - 行尾空格丢掉（`abc   \n` → `abc\n`）
 *   - 连续 spaces / tabs 合并为单个空格
 *   - 3+ 个连续换行合并为 2 个（保留段落分隔语义）
 *
 * map[i] 表示 norm[i] 在原 source 里的下标。
 */
function normalizeWithMap(s: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let inSpaceRun = false;
  let consecNewlines = 0;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (c === ' ' || c === '\t') {
      // 检查后面是不是直接接换行 → 整段行尾空白丢掉
      let j = i + 1;
      while (j < s.length && (s[j] === ' ' || s[j] === '\t')) j++;
      if (s[j] === '\n' || j === s.length) {
        i = j - 1;
        continue;
      }
      // 普通空白：合并为单个空格
      if (inSpaceRun) continue;
      norm += ' ';
      map.push(i);
      inSpaceRun = true;
      consecNewlines = 0;
    } else if (c === '\n') {
      if (consecNewlines >= 2) continue; // 3+ 换行截断到 2
      norm += '\n';
      map.push(i);
      consecNewlines++;
      inSpaceRun = false;
    } else {
      norm += c;
      map.push(i);
      inSpaceRun = false;
      consecNewlines = 0;
    }
  }
  return { norm, map };
}
