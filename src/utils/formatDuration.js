export const parseDurationToMs = (durationStr) => {
  if (!durationStr || !durationStr.includes(':')) return 0;

  const parts = durationStr.split(':').map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return 0;

  return (parts[0] * 60 + parts[1]) * 1000;
};

export const formatDurationMs = (ms) => {
  if (!ms) return "0:00";

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
