import RockSalt from '../assets/fonts/RockSalt-Regular.ttf';
import ShadowsIntoLight from '../assets/fonts/ShadowsIntoLight-Regular.ttf';
import LXGWWenKaiLite from '../assets/fonts/LXGWWenKaiLite-Regular.ttf';
import Oswald from '../assets/fonts/Oswald-VariableFont_wght.ttf';
import Inter from '../assets/fonts/Inter-VariableFont_slnt,wght.ttf';
import BebasNeue from '../assets/fonts/BebasNeue-Regular.ttf';
import Roboto from '../assets/fonts/Roboto-Regular.ttf';
import Orbitron from '../assets/fonts/Orbitron-VariableFont_wght.ttf';
import ShareTechMono from '../assets/fonts/ShareTechMono-Regular.ttf';
import NotoSansSC from '../assets/fonts/NotoSansSC-VariableFont_wght.ttf';
import NotoSerifLicense from '../assets/fonts/NotoSerifSC-OFL.txt?raw';
import NotoSerifSC from '../assets/fonts/NotoSerifSC-VariableFont_wght.ttf';
import PuHuiTi from '../assets/fonts/AlibabaPuHuiTi-3-55-Regular.ttf';
import { JCARD_DIMENSIONS } from '../constants/app.js';
import { getFontConfig } from '../config/fonts.js';

const FONT_ASSETS = {
  'Rock Salt': { url: RockSalt, weight: '400' },
  'Shadows Into Light': { url: ShadowsIntoLight, weight: '400' },
  'LXGW WenKai Lite': { url: LXGWWenKaiLite, weight: '400' },
  Oswald: { url: Oswald, weight: '200 700' },
  Inter: { url: Inter, weight: '100 900' },
  'Bebas Neue': { url: BebasNeue, weight: '400' },
  Roboto: { url: Roboto, weight: '400' },
  Orbitron: { url: Orbitron, weight: '400 900' },
  'Share Tech Mono': { url: ShareTechMono, weight: '400' },
  'Noto Sans SC': { url: NotoSansSC, weight: '100 900' },
  'Noto Serif SC': { url: NotoSerifSC, weight: '200 900' },
  'Alibaba PuHuiTi': { url: PuHuiTi, weight: '400' },
};
const fontCache = new Map();
const fontEntries = config => Object.entries(FONT_ASSETS).filter(([name]) => Object.values(config.fonts).some(family => family.includes(`'${name}'`)));
const loadFont = async (name, url) => {
  if (fontCache.has(name)) return fontCache.get(name);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`字体 ${name} 加载失败，请重试导出。`);
  const blob = await response.blob();
  const result = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`无法嵌入字体 ${name}。`));
    reader.readAsDataURL(blob);
  });
  fontCache.set(name, result);
  return result;
};

const ExportService = {
  async ensureFonts(config) {
    await Promise.all(fontEntries(config).map(async ([name]) => {
      const faces = await document.fonts.load(`24px "${name}"`, '录音作品 Album 0123');
      if (!faces.length) throw new Error(`字体 ${name} 尚未就绪。`);
    }));
    await document.fonts.ready;
  },
  async getEmbeddableFontStyles(configOrId) {
    const config = typeof configOrId === 'string' ? getFontConfig(configOrId) : configOrId;
    const styles = await Promise.all(fontEntries(config).map(async ([name, asset]) => {
      const data = await loadFont(name, asset.url);
      return `@font-face{font-family:'${name}';src:url('${data}') format('truetype');font-weight:${asset.weight};font-style:normal;}`;
    }));
    return styles.join('\n');
  },
  async serializeSVG(svg, config) {
    const css = await ExportService.getEmbeddableFontStyles(config);
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', String(JCARD_DIMENSIONS.width));
    clone.setAttribute('height', String(JCARD_DIMENSIONS.height));
    clone.removeAttribute('class');
    clone.removeAttribute('style');
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = css;
    clone.querySelector('defs').appendChild(style);
    if (Object.values(config.fonts).some(family => family.includes('Noto Serif SC'))) {
      const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
      metadata.textContent = `Noto Serif SC font license:\n${NotoSerifLicense}`;
      clone.appendChild(metadata);
    }
    return new XMLSerializer().serializeToString(clone);
  },
};
export default ExportService;
