// Deliberately independent of preset palettes, with different panel backgrounds.
export const panelColors = () => ({
  front: { background: '#182A35', title: '#F6EEDB', artist: '#DBC7AC', subtitle: '#C6D6C8', badge: '#182A35', badgeBackground: '#DBC7AC', accent: '#C69D58', border: '#C69D58' },
  back: { background: '#F3E9D4', heading: '#243A40', track: '#303A32', artist: '#5B4135', duration: '#46523A', number: '#604431', note: '#575249', metadata: '#294643', label: '#5B4135', accent: '#A96535', divider: '#A96535' },
  shortBack: { background: '#203B38', heading: '#EFE0C4', track: '#D2DACC', duration: '#E3C998', number: '#D3B891', label: '#C9CBBE', metadata: '#E6DDD2', accent: '#C49A54', badgeText: '#182A35', divider: '#C49A54' },
  spine: { background: '#AFC1B7', title: '#162E31', artist: '#293D36', id: '#4B3929', note: '#38483D', divider: '#506C62' }
});
export const designCandidate = (patch = {}) => ({ direction: 'harmony', fontTheme: 'editorial', paletteId: 'custom', colors: panelColors(), frontStyle: 'EDITORIAL', titleSize: 'balanced', reason: '蓝绿背景呼应原图，米色标题与暖色细节形成层次。', ...patch });
