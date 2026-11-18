/**
 * Runs `task` once now and then every `intervalMs`; runs never overlap. Returns the stop function. Used for closing
 * sessions whose clock ran out (a server that was off at the deadline closes them on startup, PRODUCT.md §7.27f) and for
 * starting sessions at their start time (§7.31; one missed while off is dropped instead).
 */
export function startDeadlineWatcher(closeExpired: { execute(onError?: (err: unknown) => void): Promise<unknown> }, intervalMs = 1000, onError: (err: unknown) => void = err => console.error(err)): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await closeExpired.execute(onError); } catch (err) { onError(err); } finally { busy = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
