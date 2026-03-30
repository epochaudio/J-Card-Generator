export const SHORT_BACK_MODE_VALUES = [
  'AUTO',
  'META_ARCHIVE',
  'TRACKS_COMPACT'
];

export const resolveShortBackMode = (layoutMode = 'STANDARD', shortBackMode = 'AUTO') => {
  if (shortBackMode && shortBackMode !== 'AUTO') {
    return shortBackMode;
  }

  if (layoutMode === 'CLASSICAL') {
    return 'META_ARCHIVE';
  }

  if (layoutMode === 'COMPILATION') {
    return 'TRACKS_COMPACT';
  }

  return 'TRACKS_COMPACT';
};
