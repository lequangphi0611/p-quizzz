/** Where the member merged the hooks, relative to the exercise folder. */
export const SETTINGS_LOCAL_PATH = '.claude/settings.local.json';
/** The three events the hooks listen to (docs/architecture.md §11.8 `buildHookSettings`). */
export const HOOK_EVENTS = ['UserPromptSubmit', 'PostToolUse', 'PostToolUseFailure'] as const;

/** The address every hook posts to: the server the member is on right now (`http://<host>`, the same host `hook-config` used). */
export const ingestUrl = (host: string): string => `http://${host.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/api/training/ingest`;

/** A ready-to-paste request asking Claude Code to take the hooks out again: remove, never rewrite the file. */
export function buildRemovalPrompt(host: string): string {
  return [
    `Hãy gỡ các hook của buổi training khỏi file \`${SETTINGS_LOCAL_PATH}\` của thư mục hiện tại.`,
    '',
    `- Chỉ xoá những mục hook có \`url\` là \`${ingestUrl(host)}\` (nằm trong ${HOOK_EVENTS.map(e => `\`${e}\``).join(', ')}).`,
    '- Giữ nguyên mọi cấu hình và mọi hook khác. Nếu sau khi xoá một sự kiện hook hoặc mục `hooks` bị trống thì xoá luôn phần trống đó.',
    '- Chỉ sửa đúng file này. Không sửa `~/.claude/settings.json` hay file nào khác.',
    '- Làm xong, nói cho tôi biết đã xoá những mục nào, rồi nhắc tôi mở lại Claude Code trong thư mục này.',
  ].join('\n');
}
