const two = (n: number) => String(n).padStart(2, '0');

/** Default mentor-only label for a new session: "<exam title> – dd/MM" (PRODUCT.md §7.5). */
export const defaultSessionName = (examTitle: string, now: Date): string => `${examTitle} – ${two(now.getDate())}/${two(now.getMonth() + 1)}`;

/** The name the mentor typed (trimmed), or the default when it is empty. */
export const resolveSessionName = (typed: string | undefined, examTitle: string, now: Date): string => {
  const name = typed?.trim();
  return name ? name : defaultSessionName(examTitle, now);
};
