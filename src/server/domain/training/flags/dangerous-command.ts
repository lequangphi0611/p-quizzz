import { cap, isShell, type FlagRule } from './flag-event.js';

/** Commands that can destroy work or skip the safety nets. Matched on the command line, as typed. */
export const DANGEROUS: readonly RegExp[] = [
  // recursive delete aimed outside the exercise folder: root, home, a parent, an absolute path
  /\brm\s+(?:-[a-zA-Z]*\s+)*-[a-zA-Z]*[rR][a-zA-Z]*\s+(?:-[a-zA-Z]+\s+)*(?:\/(?:\s|$|\*)|~|\$HOME|\.\.|\/[A-Za-z])/,
  /\brm\s+(?:-[a-zA-Z]+\s+)*--recursive\b.*\s(?:\/|~|\.\.)/,
  /Remove-Item\b.*-Recurse\b.*(?:[A-Za-z]:\\|~|\.\.|\$HOME|\$env:)/i,
  /\brd\s+\/s\b.*[A-Za-z]:\\/i,
  /\bgit\s+push\b.*(?:--force(?!-with-lease)\b|\s-f\b)/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\b.*-[a-zA-Z]*f/,
  /--no-verify\b/,
  /\bchmod\s+-R\s+0?777\b/,
  /\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/,
  /\bDROP\s+(?:TABLE|DATABASE)\b/i,
  /\bmkfs\b|\bdd\s+if=/,
];

export const isDangerousCommand = (command: string): boolean => DANGEROUS.some(p => p.test(command));

/** "Lệnh nguy hiểm": a shell command (run, or only asked for) that matches `DANGEROUS`. */
export const dangerousCommand: FlagRule = events => {
  const ids = events
    .filter(e => (isShell(e) || (e.kind === 'permission' && e.toolName !== null && /^(bash|powershell)$/i.test(e.toolName))) && e.toolTarget !== null && isDangerousCommand(e.toolTarget))
    .map(e => e.id);
  return ids.length > 0 ? { code: 'dangerous_command', eventIds: cap(ids) } : null;
};
