/**
 * "Đã đánh dấu đọc hết · Hoàn tác" for the 5 seconds after "Đánh dấu đã đọc hết" (S43). There is no shared toast in the UI kit, so this
 * one stays inside the feature; the controller decides how long it stays.
 */
export function UndoToast({ onUndo }: { onUndo: () => void }) {
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 50, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 16px', borderRadius: 'var(--radius-md)', background: 'var(--ink-900)', color: 'var(--paper)', font: '600 13px/1.3 var(--font-sans)', boxShadow: 'var(--shadow-raised)' }}>
      <span>Đã đánh dấu đọc hết</span>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={onUndo} style={{ height: 32, padding: '0 12px', border: '1px solid var(--ink-500)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--paper)', font: '600 13px/1 var(--font-sans)', cursor: 'pointer' }}>Hoàn tác</button>
    </div>
  );
}
