/**
 * TextUtils — 文本换行工具模块
 *
 * 重构策略（Strangler Fig Pattern / 绞杀者模式）：
 * - 新实现基于 TypographyService（Pretext 物理测量），需传入 fontFamily + fontSize
 * - 旧实现（基于字符权重估算）保留为 _legacy，供未迁移的调用方使用
 * - 通过参数嗅探自动路由：有 font 参数走新路径，没有走旧路径
 * - 待所有调用方迁移完毕后（Phase 3），将移除 _legacy 路径
 */

import TypographyService from '../services/TypographyService.js';

const TextUtils = {
  /**
   * 文本折行（统一入口）
   *
   * 双模式设计：
   * 模式 A（新）：传入 fontFamily + fontSize → 走 Pretext 物理测量
   * 模式 B（旧）：仅传 maxWidthUnits → 走字符权重估算（向后兼容）
   *
   * @param {string} text - 待折行文本
   * @param {number} maxWidthOrPx - 模式 A: 容器物理宽度 (px)；模式 B: 逻辑宽度单位数
   * @param {string} [fontFamily] - CSS font-family 字符串（传入即启用模式 A）
   * @param {number} [fontSize] - 字号 px（传入即启用模式 A）
   * @param {object} [fontOptions] - 可选字体样式 { fontWeight, fontStyle }
   * @returns {string[]} 折行后的文本行数组
   */
  getWrappedLines: (text, maxWidthOrPx, fontFamily, fontSize, fontOptions) => {
    if (!text) return [""];

    // 参数嗅探：有字体参数走 Pretext，没有走旧逻辑
    if (fontFamily && fontSize) {
      return TypographyService.wrapText(text, fontFamily, fontSize, maxWidthOrPx, fontOptions);
    }

    // 降级到旧实现
    return TextUtils._legacyGetWrappedLines(text, maxWidthOrPx);
  },

  /* ──────────────────────────────────────────────
   * 旧实现（Legacy）
   *
   * 保留原因：ContentBack.jsx 等组件在 Phase 3 之前仍依赖此逻辑。
   * 生命周期：将在 Phase 3 完成后移除。
   *
   * 已知缺陷（记录在案，不再修补）：
   * - getCharWeight 的 1.8/1.1/0.7 系数与实际字体宽度脱节
   * - 不同字体主题下同一文本的测量结果相同（错误地与字体无关）
   * ────────────────────────────────────────────── */

  /**
   * @deprecated 将在 Phase 3 后移除。请使用带 fontFamily/fontSize 参数的 getWrappedLines。
   */
  _getCharWeight: (char) => {
    if (/[\u4e00-\u9fa5\u3000-\u30ff\uff00-\uff60]/.test(char)) return 1.8;
    if (/[A-Z]/.test(char)) return 1.1;
    return 0.7;
  },

  /**
   * @deprecated 旧版折行算法。将在 Phase 3 后移除。
   */
  _legacyGetWrappedLines: (text, maxWidthUnits) => {
    if (!text) return [""];

    const lines = [];
    let currentLine = "";
    let currentWidth = 0;
    const paragraphs = text.split('\n');

    paragraphs.forEach(paragraph => {
      const words = paragraph.split(' ');
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        let wordWidth = 0;
        for (const char of word) wordWidth += TextUtils._getCharWeight(char);

        const spaceWidth = currentLine.length > 0 ? 0.5 : 0;

        if (currentWidth + spaceWidth + wordWidth <= maxWidthUnits) {
          currentLine += (currentLine.length > 0 ? " " : "") + word;
          currentWidth += spaceWidth + wordWidth;
        } else if (wordWidth > maxWidthUnits) {
          if (currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = "";
            currentWidth = 0;
          }

          let remaining = word;
          while (remaining.length > 0) {
            let chunk = "";
            let chunkWidth = 0;
            let k = 0;

            for (; k < remaining.length; k++) {
              const charWidth = TextUtils._getCharWeight(remaining[k]);
              if (chunkWidth + charWidth > maxWidthUnits) break;
              chunkWidth += charWidth;
              chunk += remaining[k];
            }

            if (chunk.length === 0 && k === 0) {
              chunk = remaining[0];
              k = 1;
            }

            lines.push(chunk);
            remaining = remaining.slice(k);
          }
        } else {
          lines.push(currentLine);
          currentLine = word;
          currentWidth = wordWidth;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
        currentWidth = 0;
      }
    });

    return lines.length > 0 ? lines : [""];
  }
};

export default TextUtils;
