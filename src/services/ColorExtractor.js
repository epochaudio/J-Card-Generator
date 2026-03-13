function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const ColorExtractor = {
  extractColor(imageSrc) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = imageSrc;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);

        try {
          const data = ctx.getImageData(0, 0, 50, 50).data;
          let r = 0, g = 0, b = 0, count = 0;
          let maxSaturation = -1;
          let bestColor = { r: 0, g: 0, b: 0 };

          for (let i = 0; i < data.length; i += 16) {
            const tr = data[i], tg = data[i + 1], tb = data[i + 2];
            const max = Math.max(tr, tg, tb), min = Math.min(tr, tg, tb);
            const l = (max + min) / 2 / 255;
            const d = (max - min) / 255;
            let s = 0;
            if (max !== min) s = l > 0.5 ? d / (2 - 2 * l) : d / (2 * l);

            if (l > 0.15 && l < 0.85 && s > 0.2) {
              if (s > maxSaturation) {
                maxSaturation = s;
                bestColor = { r: tr, g: tg, b: tb };
              }
              r += tr;
              g += tg;
              b += tb;
              count++;
            }
          }

          if (maxSaturation > 0.3) resolve(rgbToHex(bestColor.r, bestColor.g, bestColor.b));
          else if (count > 0) resolve(rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count)));
          else resolve("#cc3300");
        } catch (error) {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
    });
  },

  getContrastYIQ(hexcolor) {
    if (!hexcolor) return 'light';
    const normalized = hexcolor.replace("#", "");
    const r = parseInt(normalized.substr(0, 2), 16);
    const g = parseInt(normalized.substr(2, 2), 16);
    const b = parseInt(normalized.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? 'dark' : 'light';
  }
};

export default ColorExtractor;
