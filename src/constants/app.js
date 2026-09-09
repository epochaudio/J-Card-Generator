export const STORAGE_KEYS = {
  dashscopeApiKey: 'jcard_dashscope_api_key',
  legacyDashscopeApiKey: 'dashscope_api_key',
  legacyGeminiApiKey: 'gemini_api_key',
  themeMode: 'jcard_theme_mode',
  fontTheme: 'jcard_font_theme',
  recordingData: 'jcard_recording_data',
  equipmentPresets: 'jcard_equipment_presets'
};

export const JCARD_DIMENSIONS = {
  width: 1748,
  height: 1181,
  panels: {
    shortBack: 200,
    spine: 150,
    front: 780,
    back: 618
  },
  front: {
    reversibleImageSize: 520,
    standardCoverViewBox: 1200,
    badgeHorizontalPadding: 80,
    previewImageBottom: 780,
    artistBaseline: 1125
  }
};

// Physical widths use the existing 300 DPI print scale; keep fractional SVG units.
const PRINT_DPI = 300;
const MILLIMETERS_PER_INCH = 25.4;
const NARROW_SPINE_MM = 10.7;
export function getJCardDimensions(layout = {}) {
  const spine = layout.spineSize === 'narrow'
    ? NARROW_SPINE_MM * PRINT_DPI / MILLIMETERS_PER_INCH
    : JCARD_DIMENSIONS.panels.spine;
  return {
    ...JCARD_DIMENSIONS,
    panels: {
      ...JCARD_DIMENSIONS.panels,
      shortBack: JCARD_DIMENSIONS.panels.shortBack + JCARD_DIMENSIONS.panels.spine - spine,
      spine
    }
  };
}
