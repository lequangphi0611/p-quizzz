import type { SaveState } from '../lib/answer-saver.js';
import { Icon } from './ui/Icon.js';

export function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry?: () => void }) {
  if (state === 'error') {
    return (
      <button type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: 0, font: 'var(--type-label)', fontSize: 13, color: 'var(--wrong-600)', cursor: 'pointer' }}>
        <Icon name="cloud-alert" size={16} />Lỗi lưu — <span style={{ textDecoration: 'underline' }}>thử lại</span>
      </button>
    );
  }
  const saving = state === 'saving';
  return (
    <span aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--type-meta)', color: saving ? 'var(--text-meta)' : 'var(--correct-600)' }}>
      <Icon name={saving ? 'loader-circle' : 'check'} size={15} spin={saving} />{saving ? 'Đang lưu…' : 'Đã lưu'}
    </span>
  );
}
