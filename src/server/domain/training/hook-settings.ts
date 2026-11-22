import type { HookEntry, HookSettings } from '../../../shared/api/training.js';

export const INGEST_PATH = '/api/training/ingest';
export const INGEST_HEADER = 'X-Training-Token';
/** Seconds. Claude Code waits this long for the server on every prompt and tool call, so it must stay tiny (spike: ~0.6 s extra at 1). */
export const HOOK_TIMEOUT_SECONDS = 1;

/**
 * The hooks a member merges into `.claude/settings.local.json` of the exercise folder (PRODUCT.md §7.34d).
 * Eight events (architecture.md §11.9). No `Stop` and no `PostCompact` (they carry Claude's answer / its summary) and no `command`
 * hooks (nothing runs on the member's machine).
 */
export function buildHookSettings(baseUrl: string, ingestToken: string): HookSettings {
  const hook = { type: 'http' as const, url: baseUrl.replace(/\/+$/, '') + INGEST_PATH, headers: { [INGEST_HEADER]: ingestToken }, timeout: HOOK_TIMEOUT_SECONDS };
  const entry = (matcher?: string): HookEntry => ({ ...(matcher ? { matcher } : {}), hooks: [{ ...hook, headers: { ...hook.headers } }] });
  return {
    hooks: {
      UserPromptSubmit: [entry()],
      PostToolUse: [entry('*')],
      PostToolUseFailure: [entry('*')],
      PermissionRequest: [entry('*')],
      Notification: [entry('permission_prompt|idle_prompt')],
      PreCompact: [entry()],
      SessionEnd: [entry()],
      PostModelSwitch: [entry()],
    },
  };
}

/** A request the member pastes into Claude Code to do the merge for them: merge, never overwrite. */
export function buildMergePrompt(settings: HookSettings): string {
  return [
    'Hãy ghép (merge) đoạn cấu hình JSON bên dưới vào file `.claude/settings.local.json` của thư mục hiện tại.',
    '',
    '- Nếu file chưa có thì tạo mới. Nếu đã có thì giữ nguyên mọi cấu hình cũ, chỉ thêm các mục `hooks` mới vào (nếu đã có `hooks` thì nối thêm, không ghi đè).',
    '- Chỉ sửa đúng file này, trong thư mục hiện tại. Không sửa `~/.claude/settings.json` hay bất kỳ file nào khác.',
    '- Làm xong, nói cho tôi biết đã thêm những hook nào, rồi nhắc tôi mở lại Claude Code trong thư mục này.',
    '',
    '```json',
    JSON.stringify(settings, null, 2),
    '```',
  ].join('\n');
}
