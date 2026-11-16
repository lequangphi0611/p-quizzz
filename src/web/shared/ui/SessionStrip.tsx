import { useEffect } from 'react';
import { Button } from './Button.js';
import { Icon } from './Icon.js';
import { SessionSlot } from './SessionSlot.js';
import { StatusBadge, type SessionStatus } from './StatusBadge.js';
import { isTypingTarget, slotFromShortcut } from './session-shortcuts.js';

export interface StripSession { id: number; name: string; slot: number | null; status: SessionStatus; attention: number }

/**
 * The mentor's "Đang mở" bar: one chip per open session (slot, name, status, things waiting for the mentor), always
 * visible under the header so parallel sessions are one click, or Alt+1…9, away. Renders nothing while no session is open.
 */
export function SessionStrip({ sessions, activeId, onOpen, onNew }: { sessions: readonly StripSession[]; activeId: number | null; onOpen: (id: number) => void; onNew: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const slot = slotFromShortcut(e);
      if (slot === null || isTypingTarget(e.target)) return;
      const target = sessions.find(s => s.slot === slot);
      if (target) { e.preventDefault(); onOpen(target.id); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sessions, onOpen]);

  if (sessions.length === 0) return null;
  return (
    <nav aria-label="Phiên đang mở" style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '6px 24px', background: 'var(--paper)', borderBottom: '1px solid var(--border-hairline)', overflowX: 'auto' }}>
      <span style={{ flex: 'none', font: 'var(--type-label)', fontSize: 12, color: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Đang mở</span>
      {sessions.map(s => {
        const on = s.id === activeId;
        return (
          <button key={s.id} type="button" onClick={() => onOpen(s.id)} aria-current={on ? 'page' : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none', maxWidth: 320, height: 32, padding: '0 10px 0 6px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: on ? '2px solid var(--ink-900)' : '1px solid var(--border-strong)', background: on ? 'var(--ink-100)' : 'var(--paper)', color: 'var(--ink-900)', font: 'var(--type-ui)', fontSize: 13, fontWeight: on ? 700 : 500 }}>
            <SessionSlot n={s.slot} size={20} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <StatusBadge status={s.status} />
            {s.attention > 0 && <span title={`${s.attention} việc đang chờ bạn`} aria-label={`${s.attention} việc đang chờ bạn`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 6px', height: 18, borderRadius: 'var(--radius-pill)', background: 'var(--sun-400)', color: 'var(--ink-900)', font: '700 11px/1 var(--font-sans)' }}><Icon name="hourglass" size={11} />{s.attention}</span>}
          </button>
        );
      })}
      <span style={{ flex: 1 }} />
      <Button size="sm" variant="secondary" icon="plus" onClick={onNew}>Mở phiên mới</Button>
    </nav>
  );
}
