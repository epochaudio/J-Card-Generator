export const SHORT_BACK_MODE_VALUES = [
  'META_ARCHIVE',
  'TRACKS_COMPACT'
];

export const normalizeShortBackMode = (layoutMode = 'STANDARD', shortBackMode) => {
  if (SHORT_BACK_MODE_VALUES.includes(shortBackMode)) {
    return shortBackMode;
  }

  // 兼容旧项目里保存的 AUTO，并给缺失值一个稳定默认值。
  if (layoutMode === 'CLASSICAL') {
    return 'META_ARCHIVE';
  }

  return 'TRACKS_COMPACT';
};
