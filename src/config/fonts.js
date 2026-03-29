export const FONT_THEMES = {
    modern: {
        id: 'modern',
        name: '现代 (Modern)',
        description: 'Clean, geometric, professional.',
        fonts: {
            title: "'Oswald', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Arial Black', sans-serif",
            body: "'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Arial', sans-serif",
            serif: "'Playfair Display', 'Noto Sans SC', 'Songti SC', 'SimSun', 'Georgia', serif",
            mono: "'JetBrains Mono', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Courier New', monospace",
        }
    },
    retro: {
        id: 'retro',
        name: '胶片 (Analog)',
        description: 'Mechanical, warm, tactile.',
        fonts: {
            title: "'Bebas Neue', 'Noto Sans SC', 'Songti SC', 'SimSun', 'Arial Narrow', sans-serif",
            body: "'Roboto', 'Noto Sans SC', 'Songti SC', 'SimSun', 'Helvetica', sans-serif",
            serif: "'Roboto', 'Noto Sans SC', 'Songti SC', 'SimSun', 'Times New Roman', serif",
            mono: "'Share Tech Mono', 'Noto Sans SC', 'Songti SC', 'SimSun', 'Courier New', monospace",
        }
    },
    handwritten: {
        id: 'handwritten',
        name: '手记 (Indie)',
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
        name: '骇客 (Cyber)',
        description: 'Futuristic, glitch, terminal.',
        fonts: {
            title: "'Orbitron', 'Noto Sans SC', 'PingFang SC', 'SimHei', 'Eurostile', sans-serif",
            body: "'Share Tech Mono', 'Noto Sans SC', 'PingFang SC', 'SimHei', 'Consolas', monospace",
            serif: "'Share Tech Mono', 'Noto Sans SC', 'PingFang SC', 'SimHei', 'Consolas', monospace",
            mono: "'Share Tech Mono', 'Noto Sans SC', 'PingFang SC', 'SimHei', 'Consolas', monospace",
        }
    },
    sourcehan: {
        id: 'sourcehan',
        name: '素体 (SourceHan)',
        description: 'Clean, universal, geometric CJK.',
        fonts: {
            title: "'Noto Sans SC', 'PingFang SC', sans-serif",
            body: "'Noto Sans SC', 'PingFang SC', sans-serif",
            serif: "'Noto Sans SC', 'Songti SC', serif",
            mono: "'Noto Sans SC', 'PingFang SC', monospace",
        }
    },
    puhuiti: {
        id: 'puhuiti',
        name: '重工 (PuHuiTi)',
        description: 'Industrial, architectural, solid CJK.',
        fonts: {
            title: "'Alibaba PuHuiTi', 'Noto Sans SC', 'PingFang SC', sans-serif",
            body: "'Alibaba PuHuiTi', 'Noto Sans SC', 'PingFang SC', sans-serif",
            serif: "'Alibaba PuHuiTi', 'Noto Sans SC', 'Songti SC', serif",
            mono: "'Alibaba PuHuiTi', 'Noto Sans SC', 'PingFang SC', monospace",
        }
    }
};

export const DEFAULT_FONT_THEME = 'modern';

export const getFontConfig = (themeId) => {
    return FONT_THEMES[themeId] || FONT_THEMES[DEFAULT_FONT_THEME];
};
