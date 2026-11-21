import type { FlagContext, FlagEvent } from './flag-event.js';

let seq = 0;
export const resetEvents = () => { seq = 0; };

/** A stored event for the flag tests: `at` is in seconds from the start, for readability. */
export function ev(partial: Partial<FlagEvent> & Pick<FlagEvent, 'kind'> & { atSec?: number }): FlagEvent {
  seq++;
  const { atSec, ...rest } = partial;
  return {
    id: seq, at: (atSec ?? seq) * 1000, claudeSessionId: 's1', permissionMode: null, prompt: null, toolName: null, toolTarget: null,
    ok: null, durationMs: null, subtype: null, changeText: null, outputText: null, ...rest,
  };
}
export const prompt = (text: string, atSec?: number) => ev({ kind: 'prompt', prompt: text, atSec });
export const tool = (toolName: string, toolTarget: string | null, ok = true, extra: Partial<FlagEvent> & { atSec?: number } = {}) =>
  ev({ kind: 'tool', toolName, toolTarget, ok, ...extra });
export const session = (subtype: string, atSec?: number) => ev({ kind: 'session', subtype, atSec });
export const perm = (toolName: string, toolTarget: string | null, atSec?: number) => ev({ kind: 'permission', toolName, toolTarget, atSec });

export const ctx = (over: Partial<FlagContext> = {}): FlagContext => ({ allowAutoAccept: false, decisions: new Map(), ...over });
