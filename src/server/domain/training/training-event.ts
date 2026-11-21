import type { Clip } from './clip.js';

/** What one hook call becomes once filtered: only fields the mentor reviews (PRODUCT.md §7.34c). */
export type TrainingEventDraft = PromptDraft | ToolDraft | PermissionDraft | SessionDraft | NoticeDraft;

interface DraftBase {
  /** Claude Code's own session id: lets the mentor tell two conversations of one member apart. */
  claudeSessionId: string;
  /** Claude Code's `permission_mode` (default, acceptEdits, plan, bypassPermissions, ...) when the hook carries one. */
  permissionMode: string | null;
  /** Groups the events of one turn. Never shown. */
  promptId: string | null;
}

export interface PromptDraft extends DraftBase {
  kind: 'prompt';
  prompt: string;
}

export interface ToolDraft extends DraftBase {
  kind: 'tool';
  toolName: string;
  ok: boolean;
  durationMs: number | null;
  /** `Bash` / `PowerShell` (any tool that runs a command): the command line. Files: a path relative to the exercise folder (`Read` adds ` · N dòng`). Else null. */
  toolTarget: string | null;
  /** First lines of the tool's error (failed calls only). */
  errorExcerpt: string | null;
  /** Never set for `Read` (the output is the file itself). */
  output: Clip | null;
  change: Clip | null;
  /** `AskUserQuestion`: the pairs "question → the member's choice". Else null. */
  note: string | null;
}

/** Claude asked the member for permission (`PermissionRequest`). Whether they said yes is inferred later, never sent by Claude Code. */
export interface PermissionDraft extends DraftBase {
  kind: 'permission';
  toolName: string;
  toolTarget: string | null;
  /** What the call would change (an edit, a file to write, the plan of `ExitPlanMode`). */
  change: Clip | null;
}

export type SessionSubtype = 'clear' | 'exit' | 'compact_manual' | 'compact_auto' | 'model_switch';

/** The conversation itself changed: `/clear`, `/exit`, `/compact` (typed or automatic), `/model`. */
export interface SessionDraft extends DraftBase {
  kind: 'session';
  subtype: SessionSubtype;
  /** `/compact <text>`: the text; `model_switch`: "from → to". */
  note: string | null;
}

export type NoticeSubtype = 'waiting_permission' | 'idle';

/** Claude Code is waiting for the member. The notification's own message is dropped. */
export interface NoticeDraft extends DraftBase {
  kind: 'notice';
  subtype: NoticeSubtype;
}
