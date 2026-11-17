/**
 * Runs `closeExpired` once now (a server that was off at a session's deadline closes it on startup, PRODUCT.md §7.27f)
 * and then every `intervalMs`. Runs never overlap. Returns the stop function.
 */
export function startDeadlineWatcher(closeExpired: { execute(): Promise<unknown> }, intervalMs = 1000, onError: (err: unknown) => void = err => console.error(err)): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await closeExpired.execute(); } catch (err) { onError(err); } finally { busy = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
