export const FONT_THEMES = {
    modern: {
        id: 'modern',
        name: 'Moderno (Default)',
        description: 'Clean, geometric, professional.',
        fonts: {
            title: "'Oswald', 'PingFang SC', 'Microsoft YaHei', 'Arial Black', sans-serif",
            body: "'Inter', 'PingFang SC', 'Microsoft YaHei', 'Arial', sans-serif",
            serif: "'Playfair Display', 'Songti SC', 'SimSun', 'Georgia', serif",
            mono: "'JetBrains Mono', 'PingFang SC', 'Microsoft YaHei', 'Courier New', monospace",
        }
    },
    retro: {
        id: 'retro',
        name: 'Analog (Cassette)',
        description: 'Mechanical, warm, tactile.',
        fonts: {
            title: "'Bebas Neue', 'Songti SC', 'SimSun', 'Arial Narrow', sans-serif",
            body: "'Roboto', 'Songti SC', 'SimSun', 'Helvetica', sans-serif",
            serif: "'Roboto', 'Songti SC', 'SimSun', 'Times New Roman', serif",
            mono: "'Share Tech Mono', 'Songti SC', 'SimSun', 'Courier New', monospace",
        }
    },
    handwritten: {
        id: 'handwritten',
        name: 'Handwritten (Indie)',
        description: 'Personal, DIY, organic.',
        fonts: {
            title: "'Rock Salt', 'LXGW WenKai Lite', 'Kaiti SC', 'KaiTi', cursive",
            body: "'Shadows Into Light', 'LXGW WenKai Lite', 'Kaiti SC', 'KaiTi', cursive",
            serif: "'Shadows Into Light', 'LXGW WenKai Lite', 'Kaiti SC', 'KaiTi', cursive",
            mono: "'Shadows Into Light', 'LXGW WenKai Lite', 'Kaiti SC', 'KaiTi', cursive",
        }
    },
    digital: {
        id: 'digital',
        name: 'Digital (Cyber)',
        description: 'Futuristic, glitch, terminal.',
        fonts: {
            title: "'Orbitron', 'PingFang SC', 'SimHei', 'Eurostile', sans-serif",
            body: "'Share Tech Mono', 'PingFang SC', 'SimHei', 'Consolas', monospace",
            serif: "'Share Tech Mono', 'PingFang SC', 'SimHei', 'Consolas', monospace",
            mono: "'Share Tech Mono', 'PingFang SC', 'SimHei', 'Consolas', monospace",
        }
    }
};

export const DEFAULT_FONT_THEME = 'modern';

export const getFontConfig = (themeId) => {
    return FONT_THEMES[themeId] || FONT_THEMES[DEFAULT_FONT_THEME];
};
