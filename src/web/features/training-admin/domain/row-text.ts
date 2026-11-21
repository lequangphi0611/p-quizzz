import type { TrainingEventRow } from '../../../../shared/api/index.js';

const MODE_LABEL: Record<string, string> = {
  acceptEdits: 'Tự chấp nhận sửa file',
  bypassPermissions: 'Bỏ qua hỏi quyền',
  dontAsk: 'Không hỏi quyền',
  auto: 'Chế độ tự động',
  plan: 'Lập kế hoạch',
};

/** The permission mode of a row when it is worth saying (not `default`): "Lập kế hoạch", "Tự chấp nhận sửa file", … */
export const modeLabel = (mode: string | undefined): string | null => (mode === undefined || mode === 'default' ? null : (MODE_LABEL[mode] ?? mode));

/** Is this mode one where Claude Code stops asking? Only these get the warm chip; "plan" is just information. */
export const isAutoMode = (mode: string | undefined): boolean => mode === 'acceptEdits' || mode === 'bypassPermissions' || mode === 'dontAsk' || mode === 'auto';

/** The title of a `session` row. */
export function sessionTitle(subtype: string | undefined): string {
  switch (subtype) {
    case 'clear': return 'Bắt đầu phiên Claude mới (/clear)';
    case 'exit': return 'Thoát Claude Code';
    case 'compact_manual': return 'Nén hội thoại (bạn ấy gõ /compact)';
    case 'compact_auto': return 'Nén hội thoại (Claude Code tự nén)';
    case 'model_switch': return 'Đổi model';
    default: return 'Sự kiện phiên';
  }
}

/** The title of a `notice` row. */
export const noticeTitle = (subtype: string | undefined): string => (subtype === 'idle' ? 'Claude đang chờ bạn ấy nhập' : 'Claude đang chờ bạn ấy duyệt quyền');

/** "~2 giây" for 2 s, "~0,4 giây" under a second: the time is an estimate, so it is rounded and carries a tilde. */
export function approxSeconds(ms: number): string {
  if (ms < 1000) return `~${(Math.max(ms, 100) / 1000).toFixed(1).replace('.', ',')} giây`;
  return `~${Math.round(ms / 1000)} giây`;
}

/** What the member did with a permission request, inferred; the words always say it was inferred. */
export function decisionText(e: Pick<TrainingEventRow, 'decision' | 'decisionMs'>): { text: string; tone: 'ok' | 'no' | 'wait' } {
  if (e.decision === 'allowed') return { text: e.decisionMs !== undefined ? `Đã cho sau ${approxSeconds(e.decisionMs)} (suy ra)` : 'Đã cho (suy ra)', tone: 'ok' };
  if (e.decision === 'denied') return { text: 'Không cho (suy ra)', tone: 'no' };
  return { text: 'Đang chờ trả lời', tone: 'wait' };
}

/** `AskUserQuestion`: the "question → choice" lines of a tool row's note. */
export const noteLines = (note: string | undefined): string[] => (note ? note.split('\n').filter(l => l.trim() !== '') : []);
