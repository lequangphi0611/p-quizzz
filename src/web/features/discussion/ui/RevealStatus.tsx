import { Icon } from '../../../shared/ui/Icon.js';

function Chip({ icon, label, on }: { icon: string; label: string; on: boolean }) {
  return (
    <span role="status" aria-label={`${label}: ${on ? 'đã hiện' : 'đang ẩn'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 52, padding: '0 18px 0 14px', boxSizing: 'border-box', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap',
      border: '2px ' + (on ? 'solid var(--sun-400)' : 'dashed var(--screen-line-strong)'), background: on ? 'var(--screen-pending-surface)' : 'transparent',
      color: on ? 'var(--screen-text)' : 'var(--screen-meta)', font: '600 24px/1 var(--font-sans)', transition: 'background var(--dur-slow) var(--ease-standard), border-color var(--dur-slow) var(--ease-standard)' }}>
      <Icon name={icon} size={24} style={{ color: on ? 'var(--sun-400)' : undefined }} />
      {label}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 10, borderLeft: '2px solid ' + (on ? 'rgba(255,210,63,.35)' : 'var(--screen-line)'), color: on ? 'var(--sun-400)' : 'var(--screen-meta)', fontWeight: on ? 700 : 500 }}>
        <Icon name={on ? 'eye' : 'eye-off'} size={22} />{on ? 'Đã hiện' : 'Đang ẩn'}
      </span>
    </span>
  );
}

/**
 * S25: fixed two-chip indicator so the class can tell at a glance what is open for the question on screen.
 * Hidden = dashed grey outline + eye-off + "Đang ẩn"; shown = solid sun outline + eye + "Đã hiện". Never colour alone.
 */
export function RevealStatus({ work, answer }: { work: boolean; answer: boolean }) {
  return (
    <div aria-label="Trạng thái câu" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
      <Chip icon="users" label="Bài làm" on={work} />
      <Chip icon="key-round" label="Đáp án" on={answer} />
    </div>
  );
}
