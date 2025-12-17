
import RockSalt from '../assets/fonts/RockSalt-Regular.ttf';
import ShadowsIntoLight from '../assets/fonts/ShadowsIntoLight-Regular.ttf';
import LXGWWenKaiLite from '../assets/fonts/LXGWWenKaiLite-Regular.ttf';
import Oswald from '../assets/fonts/Oswald-VariableFont_wght.ttf';
import Inter from '../assets/fonts/Inter-VariableFont_slnt,wght.ttf';
import BebasNeue from '../assets/fonts/BebasNeue-Regular.ttf';
import Roboto from '../assets/fonts/Roboto-Regular.ttf';
import Orbitron from '../assets/fonts/Orbitron-VariableFont_wght.ttf';
import ShareTechMono from '../assets/fonts/ShareTechMono-Regular.ttf';

const fontCache = {};

const loadFontToBase64 = async (name, url) => {
    if (fontCache[name]) return fontCache[name];
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result;
                fontCache[name] = base64;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`Error loading font ${name}:`, error);
        return null;
    }
};

const ExportService = {
    /**
     * Generates @font-face CSS blocks with embedded Base64 data for the specified theme.
     * Supports 'modern', 'retro', 'handwritten', 'digital'.
     */
    getEmbeddableFontStyles: async (fontThemeId) => {
        let fontsToEmbed = [];

        // Define font requirements per theme to minimize payload
        switch (fontThemeId) {
            case 'modern':
                fontsToEmbed = [
                    { name: 'Oswald', url: Oswald },
                    { name: 'Inter', url: Inter }
                ];
                break;
            case 'retro': // Analog
                fontsToEmbed = [
                    { name: 'Bebas Neue', url: BebasNeue },
                    { name: 'Roboto', url: Roboto },
                    { name: 'Share Tech Mono', url: ShareTechMono } // Mono fallback
                ];
                break;
            case 'handwritten':
                fontsToEmbed = [
                    { name: 'Rock Salt', url: RockSalt },
                    { name: 'Shadows Into Light', url: ShadowsIntoLight },
                    { name: 'LXGW WenKai Lite', url: LXGWWenKaiLite }
                ];
                break;
            case 'digital':
                fontsToEmbed = [
                    { name: 'Orbitron', url: Orbitron },
                    { name: 'Share Tech Mono', url: ShareTechMono }
                ];
                break;
            default:
                // Embed fallback defaults just in case
                fontsToEmbed = [
                    { name: 'Oswald', url: Oswald },
                    { name: 'Inter', url: Inter }
                ];
        }

        let css = '';
        for (const font of fontsToEmbed) {
            const dataUrl = await loadFontToBase64(font.name, font.url);
            if (dataUrl) {
                css += `
          @font-face {
            font-family: '${font.name}';
            src: url('${dataUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `;
            }
        }
        return css;
    }
};

export default ExportService;
