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

/**
 * 在 source 里定位一段 find（可能模糊）。找不到返 null。
 * 调用方可以：source.slice(0, pos.start) + replace + source.slice(pos.end)
 */
export function findEditPosition(source: string, find: string): MatchPosition | null {
  if (!find) return null;

  // 1. 精确匹配
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
 * 应用一条 find/replace。找不到返 { matched: false } + 原文不动。
 */
export function applyEdit(
  source: string,
  find: string,
  replace: string,
): { md: string; matched: boolean; fuzzy: boolean } {
  const pos = findEditPosition(source, find);
  if (!pos) return { md: source, matched: false, fuzzy: false };
  return {
    md: source.slice(0, pos.start) + replace + source.slice(pos.end),
    matched: true,
    fuzzy: pos.fuzzy,
  };
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
