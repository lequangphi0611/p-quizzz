type SaveState = 'saved' | 'saving' | 'error';
import { Icon } from '../../components/ui/Icon.js';

// 'offline': the member's device has no network — answers wait in memory and are sent when it is back.
export function SaveIndicator({ state, onRetry, size = 'md' }: { state: SaveState | 'unsaved' | 'offline'; onRetry?: () => void; size?: 'md' | 'screen' }) {
  const scr = size === 'screen';
  const fs = scr ? 22 : 13, ic = scr ? 24 : 15;
  if (state === 'error') {
    return (
      <button type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: scr ? 10 : 6, background: 'none', border: 0, padding: 0, font: 'var(--type-label)', fontSize: fs, color: scr ? 'var(--screen-wrong)' : 'var(--wrong-600)', cursor: 'pointer' }}>
        <Icon name="cloud-alert" size={ic + 1} />Lỗi lưu — <span style={{ textDecoration: 'underline' }}>thử lại</span>
      </button>
    );
  }
  const looks: Record<'saving' | 'saved' | 'unsaved' | 'offline', [string, string, string]> = {
    offline: ['cloud-off', 'Chờ có mạng', 'var(--warn-600)'],
    saving: ['loader-circle', 'Đang lưu…', scr ? 'var(--screen-meta)' : 'var(--text-meta)'],
    saved: ['check', 'Đã lưu', scr ? 'var(--screen-correct)' : 'var(--correct-600)'],
    unsaved: ['circle-dot', 'Chưa lưu', scr ? 'var(--screen-meta)' : 'var(--text-meta)'],
  };
  const [icon, text, color] = looks[state];
  return (
    <span aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: scr ? 10 : 6, font: 'var(--type-meta)', fontSize: scr ? fs : undefined, fontWeight: scr || state === 'offline' ? 600 : undefined, color, whiteSpace: 'nowrap' }}>
      <Icon name={icon} size={ic} spin={state === 'saving'} />{text}
    </span>
  );
}
