const TextUtils = {
  getCharWeight: (char) => {
    if (/[\u4e00-\u9fa5\u3000-\u30ff\uff00-\uff60]/.test(char)) return 1.8;
    if (/[A-Z]/.test(char)) return 1.1;
    return 0.7;
  },

  getWrappedLines: (text, maxWidthUnits) => {
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
        for (const char of word) wordWidth += TextUtils.getCharWeight(char);

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
              const charWidth = TextUtils.getCharWeight(remaining[k]);
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
