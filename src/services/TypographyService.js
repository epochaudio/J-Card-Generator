/**
 * TypographyService — 基于 Pretext 的文本物理测量服务
 *
 * 设计理念 (Clean Architecture)：
 * - Pretext 作为实现细节被完全封装，上层只依赖本模块暴露的接口
 * - 所有方法均为纯函数 + 内存计算，不触碰 DOM 布局引擎
 * - 若 Pretext 未来 API 变更，只需修改此文件
 *
 * 关键约束 (来自 Pretext 文档)：
 * - font 参数须为 CSS shorthand 格式，如 "16px Inter"
 * - 不支持 system-ui（macOS 精度问题），必须使用具名字体
 * - 默认行为等价于 CSS: white-space:normal + overflow-wrap:break-word
 */

import {
  prepareWithSegments,
  layoutWithLines,
  layout,
  walkLineRanges,
} from '@chenglou/pretext';

/* ──────────────────────────────────────────────
 * 内部工具：CSS font-family 字符串 → Pretext font shorthand
 *
 * 为什么需要这个转换？
 * 项目的 fontConfig 格式是完整的 CSS font-family 值，
 * 如 "'Oswald', 'PingFang SC', sans-serif"
 * 而 Pretext 需要 Canvas ctx.font 格式，如 "16px Oswald"
 * 我们取回退链中的第一个具名字体作为测量基准
 * ────────────────────────────────────────────── */

/**
 * 从 CSS font-family 字符串中提取第一个具名字体
 * @param {string} fontFamily - CSS font-family，如 "'Oswald', 'PingFang SC', sans-serif"
 * @returns {string} 具名字体，如 "Oswald"
 */
function extractPrimaryFont(fontFamily) {
  if (!fontFamily) return 'Arial';

  // 按逗号分割，取第一个非泛型（generic）字段
  const genericFamilies = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
  ]);

  const parts = fontFamily.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
  const named = parts.find(p => !genericFamilies.has(p.toLowerCase()));
  return named || 'Arial';
}

/**
 * 构造 Pretext 所需的 font shorthand
 * @param {string} fontFamily - CSS font-family 字符串
 * @param {number} fontSize - 字号（px）
 * @param {object} [options] - 可选的字体样式
 * @param {string} [options.fontWeight] - 字重，如 "bold"
 * @param {string} [options.fontStyle] - 字体样式，如 "italic"
 * @returns {string} Canvas font shorthand，如 "bold 16px Oswald"
 */
function buildFontShorthand(fontFamily, fontSize, options = {}) {
  const primary = extractPrimaryFont(fontFamily);
  const parts = [];

  // Canvas font shorthand 格式: [font-style] [font-weight] font-size font-family
  if (options.fontStyle) parts.push(options.fontStyle);
  if (options.fontWeight) parts.push(options.fontWeight);
  parts.push(`${fontSize}px`);
  parts.push(`"${primary}"`);

  return parts.join(' ');
}

/* ──────────────────────────────────────────────
 * 公开 API
 * ────────────────────────────────────────────── */

const TypographyService = {
  /**
   * 测量给定文本在指定字体/字号下的物理像素宽度
   *
   * 实现方式：将文本放入一个极宽的容器 (99999px) 中进行单行测量，
   * 然后通过 walkLineRanges 获取第一行的实际宽度。
   *
   * @param {string} text - 待测量文本
   * @param {string} fontFamily - CSS font-family 字符串
   * @param {number} fontSize - 字号 (px)
   * @param {object} [fontOptions] - 可选字体样式 { fontWeight, fontStyle }
   * @returns {number} 文本渲染后的物理宽度 (px)
   */
  measureWidth(text, fontFamily, fontSize, fontOptions = {}) {
    if (!text) return 0;

    const font = buildFontShorthand(fontFamily, fontSize, fontOptions);
    const prepared = prepareWithSegments(text, font);

    // 用一个极宽的容器强制单行排版，获取实际宽度
    let width = 0;
    walkLineRanges(prepared, 99999, (line) => {
      width = line.width;
    });

    return width;
  },

  /**
   * 在给定容器物理宽度内，对文本执行精确折行
   *
   * 为什么使用 layoutWithLines 而非自行实现？
   * → Pretext 内部已正确处理了 Unicode 断词、双向文本（Bidi）、
   *   Emoji 合成等复杂场景，自行实现会丢失这些能力。
   *
   * @param {string} text - 待折行文本
   * @param {string} fontFamily - CSS font-family 字符串
   * @param {number} fontSize - 字号 (px)
   * @param {number} maxWidthPx - 容器最大可用物理宽度 (px)
   * @param {object} [fontOptions] - 可选字体样式 { fontWeight, fontStyle }
   * @returns {string[]} 折行后的文本行数组
   */
  wrapText(text, fontFamily, fontSize, maxWidthPx, fontOptions = {}) {
    if (!text) return [''];

    const paragraphs = text.split('\n');
    const allLines = [];

    const font = buildFontShorthand(fontFamily, fontSize, fontOptions);
    const lineHeight = Math.round(fontSize * 1.2);

    for (const p of paragraphs) {
      if (!p) {
        allLines.push('');
        continue;
      }
      const prepared = prepareWithSegments(p, font);
      const { lines } = layoutWithLines(prepared, maxWidthPx, lineHeight);
      if (lines.length === 0) {
        allLines.push('');
      } else {
        allLines.push(...lines.map(line => line.text));
      }
    }

    if (allLines.length === 0) return [''];
    return allLines;
  },

  /**
   * 二分搜索：在给定容器宽度内，找到能让文本保持单行的最大字号
   *
   * 算法原理：
   * 1. 在 [minFontSize, maxFontSize] 范围内进行二分搜索
   * 2. 对每个候选字号，用 Pretext 的 layout() 检查是否溢出（lineCount > 1）
   * 3. 收敛到最大的不溢出字号
   *
   * 为什么用 layout() 而非 measureWidth()?
   * → layout() 已内置了换行判断逻辑，比手动比较宽度更准确。
   *   且 layout() 是 Pretext 最快的 hot path (~0.1ms/500次)。
   *
   * @param {string} text - 待适配文本
   * @param {string} fontFamily - CSS font-family 字符串
   * @param {number} maxWidthPx - 容器最大物理宽度 (px)
   * @param {number} minFontSize - 字号下限 (px)
   * @param {number} maxFontSize - 字号上限 (px)
   * @param {object} [fontOptions] - 可选字体样式 { fontWeight, fontStyle }
   * @returns {number} 最优字号 (px)，整数
   */
  fitFontSize(text, fontFamily, maxWidthPx, minFontSize, maxFontSize, fontOptions = {}) {
    if (!text) return maxFontSize;

    let low = minFontSize;
    let high = maxFontSize;

    // 二分搜索，精度到 1px 即可满足 SVG 渲染需求
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const font = buildFontShorthand(fontFamily, mid, fontOptions);
      const prepared = prepareWithSegments(text, font);
      const lineHeight = Math.round(mid * 1.2);
      const { lineCount } = layout(prepared, maxWidthPx, lineHeight);

      if (lineCount <= 1) {
        // 还能塞下，尝试更大的字号
        low = mid;
      } else {
        // 溢出了，需要更小的字号
        high = mid - 1;
      }
    }

    return low;
  },

  /**
   * 二分搜索：找到能让文本在允许多行的情况下填满容器的最大字号
   *
   * 与 fitFontSize 的区别：
   * - fitFontSize 要求单行放下（脊部标题等场景）
   * - fitFontSizeMultiline 允许折行，但总高度不超过容器高度（曲目列表等场景）
   *
   * @param {string} text - 待适配文本
   * @param {string} fontFamily - CSS font-family 字符串
   * @param {number} maxWidthPx - 容器宽度 (px)
   * @param {number} maxHeightPx - 容器高度 (px)
   * @param {number} minFontSize - 字号下限 (px)
   * @param {number} maxFontSize - 字号上限 (px)
   * @param {object} [fontOptions] - 可选字体样式
   * @returns {number} 最优字号 (px)
   */
  fitFontSizeMultiline(text, fontFamily, maxWidthPx, maxHeightPx, minFontSize, maxFontSize, fontOptions = {}) {
    if (!text) return maxFontSize;

    let low = minFontSize;
    let high = maxFontSize;

    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const font = buildFontShorthand(fontFamily, mid, fontOptions);
      const prepared = prepareWithSegments(text, font);
      const lineHeight = Math.round(mid * 1.4); // 多行场景给稍大行高以提高可读性
      const { height } = layout(prepared, maxWidthPx, lineHeight);

      if (height <= maxHeightPx) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return low;
  },

  /**
   * 获取文本在指定参数下的完整布局信息
   *
   * 当调用方同时需要行数、高度和折行内容时使用，
   * 避免重复调用 prepare。
   *
   * @param {string} text - 待排版文本
   * @param {string} fontFamily - CSS font-family 字符串
   * @param {number} fontSize - 字号 (px)
   * @param {number} maxWidthPx - 容器宽度 (px)
   * @param {number} lineHeight - 行高 (px)
   * @param {object} [fontOptions] - 可选字体样式
   * @returns {{ lines: string[], lineWidths: number[], height: number, lineCount: number }}
   */
  getFullLayout(text, fontFamily, fontSize, maxWidthPx, lineHeight, fontOptions = {}) {
    if (!text) return { lines: [''], lineWidths: [0], height: 0, lineCount: 0 };

    const font = buildFontShorthand(fontFamily, fontSize, fontOptions);
    const prepared = prepareWithSegments(text, font);
    const result = layoutWithLines(prepared, maxWidthPx, lineHeight);

    if (result.lines.length === 0) {
      return { lines: [''], lineWidths: [0], height: 0, lineCount: 0 };
    }

    return {
      lines: result.lines.map(l => l.text),
      lineWidths: result.lines.map(l => l.width),
      height: result.height,
      lineCount: result.lineCount,
    };
  },

  // 暴露内部工具，供调试和测试使用
  _extractPrimaryFont: extractPrimaryFont,
  _buildFontShorthand: buildFontShorthand,
};

export default TypographyService;
