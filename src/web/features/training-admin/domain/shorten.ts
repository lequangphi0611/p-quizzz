export interface Shortened {
  text: string;
  /** True when the shown text is not the whole command: the row offers "xem đầy đủ". */
  truncated: boolean;
}

/** One line of at most `max` characters for a command or file name; a multi-line command shows its first line and a mark. */
export function shortenTarget(text: string, max = 90): Shortened {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const first = lines[0] ?? '';
  const chars = Array.from(first);
  if (chars.length > max) return { text: `${chars.slice(0, max - 1).join('')}…`, truncated: true };
  return lines.length > 1 ? { text: `${first} …`, truncated: true } : { text: first, truncated: false };
}
