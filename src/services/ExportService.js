import ZCOOLQingKeHuangYou from '../assets/fonts/ZCOOLQingKeHuangYou-Regular.ttf';
import ZCOOLLicense from '../assets/fonts/ZCOOL-OFL.txt?raw';
import GlowSansCondensedBold from '../assets/fonts/GlowSansSC-Condensed-Bold.otf';
import GlowSansCondensed from '../assets/fonts/GlowSansSC-Condensed-Regular.otf';
import GlowSansLicense from '../assets/fonts/GlowSans-OFL.txt?raw';
import ChillGSans from '../assets/fonts/ChillGSans.otf';
import ChillGSansLicense from '../assets/fonts/ChillGSans-OFL.txt?raw';
import LongCang from '../assets/fonts/LongCang-Regular.ttf';
import LongCangLicense from '../assets/fonts/LongCang-OFL.txt?raw';
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
  'ZCOOL QingKe HuangYou': { url: ZCOOLQingKeHuangYou, weight: '400', license: ZCOOLLicense },
  'Glow Sans SC Condensed': { url: GlowSansCondensed, weight: '400', boldUrl: GlowSansCondensedBold, format: 'opentype', license: GlowSansLicense },
  'Chill G Sans': { url: ChillGSans, weight: '400', format: 'opentype', license: ChillGSansLicense },
  'Long Cang': { url: LongCang, weight: '400' },
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
  if (fontCache.has(url)) return fontCache.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`字体 ${name} 加载失败，请重试导出。`);
  const blob = await response.blob();
  const result = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`无法嵌入字体 ${name}。`));
    reader.readAsDataURL(blob);
  });
  fontCache.set(url, result);
  return result;
};

const ExportService = {
  async ensureFonts(config) {
    await Promise.all(fontEntries(config).map(async ([name, asset]) => {
      if (asset.boldUrl) await document.fonts.load(`700 24px "${name}"`, '录音作品 Album 0123');
      const faces = await document.fonts.load(`24px "${name}"`, '录音作品 Album 0123');
      if (!faces.length) throw new Error(`字体 ${name} 尚未就绪。`);
    }));
    await document.fonts.ready;
  },
  async getEmbeddableFontStyles(configOrId) {
    const config = typeof configOrId === 'string' ? getFontConfig(configOrId) : configOrId;
    const styles = await Promise.all(fontEntries(config).map(async ([name, asset]) => {
      const data = await loadFont(name, asset.url);
      const regular = `@font-face{font-family:'${name}';src:url('${data}') format('${asset.format || 'truetype'}');font-weight:${asset.weight};font-style:normal;}`;
      if (!asset.boldUrl) return regular;
      const bold = await loadFont(name, asset.boldUrl);
      return regular + `\n@font-face{font-family:'${name}';src:url('${bold}') format('${asset.format || 'truetype'}');font-weight:700;font-style:normal;}`;
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
    if (Object.values(config.fonts).some(family => family.includes("'Long Cang'"))) {
      const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
      metadata.textContent = `Long Cang font license:\n${LongCangLicense}`;
      clone.appendChild(metadata);
    }
    for (const [name, asset] of fontEntries(config)) {
      if (!asset.license) continue;
      const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
      metadata.textContent = `${name} font license:\n${asset.license}`;
      clone.appendChild(metadata);
    }
    return new XMLSerializer().serializeToString(clone);
  },
};
export default ExportService;
