/**
 * The number of an open session ("slot"): lowest free number when it opened, freed when it closes. It is the quick way
 * for the mentor to tell parallel sessions apart without relying on colour (PRODUCT.md §7.5). Alt+1…9 jumps to it.
 */
export function SessionSlot({ n, size = 20 }: { n: number | null; size?: 16 | 20 | 28 }) {
  return (
    <span aria-label={n === null ? 'Chưa có số phiên' : `Phiên số ${n}`} title={n === null ? undefined : `Alt+${n}`}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', minWidth: size, height: size, padding: '0 4px', boxSizing: 'border-box', borderRadius: size <= 20 ? 5 : 7, background: 'var(--ink-900)', color: '#fff', font: `700 ${Math.round(size * 0.58)}px/1 var(--font-mono)` }}>
      {n ?? '–'}
    </span>
  );
}
