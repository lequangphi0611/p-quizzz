import type { Clip } from '../../../../shared/api/index.js';

/** Vietnamese groups thousands with a dot: 9600 → "9.600". */
const groupThousands = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const omittedLabel = (n: number): string => `… đã lược bỏ ${groupThousands(n)} dòng …`;

export interface ClipView {
  head: string;
  /** The separator between the first and the last lines; null when nothing was left out. */
  omitted: string | null;
  tail: string | null;
}

/** A clip as the panel shows it: first lines, "… đã lược bỏ N dòng …", last lines. */
export function clipView(clip: Clip): ClipView {
  return { head: clip.head, omitted: clip.tail !== null && clip.omittedLines > 0 ? omittedLabel(clip.omittedLines) : null, tail: clip.tail };
}

export type ChangeLineKind = 'add' | 'del' | 'plain';
export interface ChangeLine { kind: ChangeLineKind; text: string }

/** Edit changes are stored as `- old` / `+ new` lines; a written file is plain text. */
export function changeLines(text: string): ChangeLine[] {
  return text.split('\n').map(line => ({ kind: line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'plain', text: line }));
}
