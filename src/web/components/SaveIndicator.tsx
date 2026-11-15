import type { SaveState } from '../lib/answer-saver.js';
import { Icon } from './ui/Icon.js';

export function SaveIndicator({ state, onRetry, size = 'md' }: { state: SaveState | 'unsaved'; onRetry?: () => void; size?: 'md' | 'screen' }) {
  const scr = size === 'screen';
  const fs = scr ? 22 : 13, ic = scr ? 24 : 15;
  if (state === 'error') {
    return (
      <button type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: scr ? 10 : 6, background: 'none', border: 0, padding: 0, font: 'var(--type-label)', fontSize: fs, color: scr ? 'var(--screen-wrong)' : 'var(--wrong-600)', cursor: 'pointer' }}>
        <Icon name="cloud-alert" size={ic + 1} />Lỗi lưu — <span style={{ textDecoration: 'underline' }}>thử lại</span>
      </button>
    );
  }
  const looks: Record<'saving' | 'saved' | 'unsaved', [string, string, string]> = {
    saving: ['loader-circle', 'Đang lưu…', scr ? 'var(--screen-meta)' : 'var(--text-meta)'],
    saved: ['check', 'Đã lưu', scr ? 'var(--screen-correct)' : 'var(--correct-600)'],
    unsaved: ['circle-dot', 'Chưa lưu', scr ? 'var(--screen-meta)' : 'var(--text-meta)'],
  };
  const [icon, text, color] = looks[state];
  return (
    <span aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: scr ? 10 : 6, font: 'var(--type-meta)', fontSize: scr ? fs : undefined, fontWeight: scr ? 600 : undefined, color }}>
      <Icon name={icon} size={ic} spin={state === 'saving'} />{text}
    </span>
  );
}
