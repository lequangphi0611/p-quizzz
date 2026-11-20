/** A summary is one glance on the timeline: never longer than this (an error excerpt keeps its lines, each is cut). */
export const SUMMARY_LINE_CHARS = 200;

const cut = (line: string) => (line.length > SUMMARY_LINE_CHARS ? `${line.slice(0, SUMMARY_LINE_CHARS)}…` : line);

/**
 * What a tool call came to, in a few words: a failed call → its error excerpt; a successful one → the last line of its output
 * that has any text. `outputEnd` is the end of the stored output (the list never loads the whole of it).
 * Nothing to show → null.
 */
export function buildSummary(call: { ok: boolean; errorExcerpt: string | null; outputEnd: string | null }): string | null {
  if (!call.ok) {
    const lines = (call.errorExcerpt ?? '').split(/\r?\n/).map(l => l.trimEnd());
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
    while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
    return lines.length > 0 ? lines.map(cut).join('\n') : null;
  }
  const last = (call.outputEnd ?? '').split(/\r?\n/).reverse().find(l => l.trim() !== '');
  return last === undefined ? null : cut(last.trim());
}
