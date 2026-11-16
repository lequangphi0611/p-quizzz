import { Icon } from './Icon.js';
export function Spinner({ size = 20, label, block = false }: { size?: number; label?: string; block?: boolean }) {
  return (
    <div role="status" style={{ display: block ? 'flex' : 'inline-flex', flexDirection: block ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: block ? 10 : 8, color: 'var(--text-meta)', font: 'var(--type-meta)', padding: block ? 32 : 0 }}>
      <Icon name="loader-circle" size={size} spin color="var(--brand-600)" />
      {label && <span>{label}</span>}
    </div>
  );
}