// Locate a wrapped line in its source: wrapping may trim spaces at line breaks.
export function splitWrappedLine(source, lines, index, boundary) {
  let offset = 0;
  for (const previous of lines.slice(0, index)) {
    const start = source.indexOf(previous, offset);
    offset = (start < 0 ? offset : start) + previous.length;
  }
  const line = lines[index];
  const start = source.indexOf(line.replace(/\.\.\.$/, ''), offset);
  if (start >= 0) offset = start;
  const split = Math.max(0, Math.min(line.length, boundary - offset));
  return [line.slice(0, split), line.slice(split)];
}
