const pad2 = (n: number) => String(n).padStart(2, '0');

/** How long a command ran: "48 ms", "3,2 s", "12 s", "1 phút 05 s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 10_000) {
    const tenths = Math.round(ms / 100);
    if (tenths < 100) return `${Math.floor(tenths / 10)},${tenths % 10} s`;
  }
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} s`;
  return `${Math.floor(total / 60)} phút ${pad2(total % 60)} s`;
}
