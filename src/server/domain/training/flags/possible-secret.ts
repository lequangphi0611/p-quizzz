import { looksLikeSecret } from '../secrets.js';
import { cap, type FlagRule } from './flag-event.js';

/** "Có thể lộ bí mật": a prompt, command, edit or output holds something shaped like a key, a token or a password. */
export const possibleSecret: FlagRule = events => {
  const ids = events
    .filter(e => [e.prompt, e.toolTarget, e.changeText, e.outputText].some(t => t !== null && t !== '' && looksLikeSecret(t)))
    .map(e => e.id);
  return ids.length > 0 ? { code: 'possible_secret', eventIds: cap(ids) } : null;
};
