export const FONT_THEMES = {
    modern: {
        id: 'modern',
        name: 'Moderno (Default)',
        description: 'Clean, geometric, professional.',
        fonts: {
            title: "'Oswald', 'Arial Black', sans-serif",
            body: "'Inter', 'Arial', sans-serif",
            serif: "'Playfair Display', 'Georgia', serif",
            mono: "'JetBrains Mono', 'Courier New', monospace",
        }
    },
    retro: {
        id: 'retro',
        name: 'Analog (Cassette)',
        description: 'Mechanical, warm, tactile.',
        fonts: {
            title: "'Bebas Neue', 'Arial Narrow', sans-serif",
            body: "'Roboto', 'Helvetica', sans-serif",
            serif: "'Merriweather', 'Times New Roman', serif",
            mono: "'Courier Prime', 'Courier New', monospace",
        }
    },
    handwritten: {
        id: 'handwritten',
        name: 'Handwritten (Indie)',
        description: 'Personal, DIY, organic.',
        fonts: {
            title: "'Patrick Hand', 'Comic Sans MS', cursive",
            body: "'Kalam', 'Segoe UI', sans-serif",
            serif: "'Kalam', 'Segoe UI', serif", // Reusing Kalam for consistency in handwritten style
            mono: "'Patrick Hand', 'Courier New', monospace",
        }
    },
    digital: {
        id: 'digital',
        name: 'Digital (Cyber)',
        description: 'Futuristic, glitch, terminal.',
        fonts: {
            title: "'Orbitron', 'Eurostile', sans-serif",
            body: "'Share Tech Mono', 'Consolas', monospace",
            serif: "'Share Tech Mono', 'Consolas', monospace", // Mono rules in digital
            mono: "'Share Tech Mono', 'Consolas', monospace",
        }
    }
};

export const DEFAULT_FONT_THEME = 'modern';

export const getFontConfig = (themeId) => {
    return FONT_THEMES[themeId] || FONT_THEMES[DEFAULT_FONT_THEME];
};
