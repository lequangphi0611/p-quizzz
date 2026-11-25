import { useEffect, useRef } from 'react';
import type { TrainingMemberRow } from '../../../../shared/api/index.js';
import { dayAndClock } from '../domain/days.js';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import type { PanelKind, PanelState, TimelineState, TrainingController } from '../application/training-controller.js';
import { modeLabel } from '../domain/row-text.js';
import { buildTimeline } from '../domain/timeline.js';
import { TeachingButton } from './TeachingButton.js';
import { NoticeRow, PermissionRow, SessionRow, ToolRow } from './TimelineRows.js';

/** Width of the output drawer; the popup leaves this much room on the right while the drawer is open. */
export const DRAWER_WIDTH = 'min(460px, 42vw)';

/**
 * The commands of one prompt in a popup, big enough to read at a glance. It is an overlay: the members and the list behind it
 * keep their size. While the output drawer is open the popup moves left to make room for it. Esc closes the drawer first, then this.
 */
export function TurnDetail({ turnKey, member, timeline, panel, ctrl }: { turnKey: string; member: TrainingMemberRow; timeline: TimelineState; panel: PanelState | null; ctrl: TrainingController }) {
  const turn = buildTimeline(timeline.events, { memberStuck: member.stuck }).find(i => i.kind === 'turn' && i.key === turnKey);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => { dialog.current?.focus({ preventScroll: true }); }, [turnKey]);
  if (!turn || turn.kind !== 'turn') return null;

  const onOpen = (id: number, kind: PanelKind) => void ctrl.openDetail(id, kind);
  const onMark = (id: number) => void ctrl.toggleMark(id);
  const mode = modeLabel(turn.prompt?.permissionMode);
  const title = turn.prompt ? `Prompt ${turn.promptNumber ?? ''}`.trim() : 'Lệnh chạy trước prompt đầu tiên';

  return (
    <div onClick={e => { if (e.target === e.currentTarget) ctrl.closeTurn(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16, paddingRight: panel ? `calc(${DRAWER_WIDTH} + 32px)` : 16, transition: 'padding var(--dur-base) var(--ease-standard)' }}>
      <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Chi tiết các lệnh của ${title}`}
        style={{ width: '100%', maxWidth: 1040, maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', background: 'var(--paper)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-dialog)', overflow: 'hidden', outline: 'none' }}>
        <header style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border-hairline)', background: turn.prompt ? 'var(--brand-050)' : 'var(--surface-sunken)' }}>
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--brand-700)' }}>
              <Icon name={turn.prompt ? 'message-square' : 'terminal'} size={16} />{title} · {member.displayName}
              {turn.prompt && <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-meta)', font: '500 13px/1 var(--font-mono)' }}>{dayAndClock(turn.prompt.receivedAt)}</span>}
              {mode && <span style={{ textTransform: 'none', letterSpacing: 0, padding: '0 7px', borderRadius: 'var(--radius-pill)', background: 'var(--paper)', border: '1px solid var(--ink-300)', color: 'var(--ink-700)', fontSize: 12 }}>{mode}</span>}
            </span>
            {turn.prompt && <p style={{ margin: 0, maxHeight: '24vh', overflow: 'auto', font: '500 16px/1.5 var(--font-sans)', color: 'var(--text-title)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{turn.prompt.prompt}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {turn.prompt && member.teachingConsent && <TeachingButton id={turn.prompt.id} label={turn.prompt.teachingExample?.label ?? null} onOpen={id => ctrl.openTeaching(id)} />}
            <Button variant="ghost" size="sm" icon="x" ariaLabel="Đóng (Esc)" onClick={() => ctrl.closeTurn()} />
          </div>
        </header>
        <ol aria-label="Các lệnh" style={{ listStyle: 'none', margin: 0, padding: '10px 14px 16px', overflow: 'auto', display: 'grid', gap: 2, alignContent: 'start' }}>
          {turn.tools.map(t => {
            const focused = timeline.focusId === t.event.id;
            return t.event.kind === 'permission' ? <PermissionRow key={t.event.id} event={t.event} panel={panel} focused={focused} onOpen={onOpen} onMark={onMark} />
              : t.event.kind === 'session' ? <SessionRow key={t.event.id} event={t.event} focused={focused} />
              : t.event.kind === 'notice' ? <NoticeRow key={t.event.id} event={t.event} focused={focused} />
              : <ToolRow key={t.event.id} tool={t} panel={panel} focused={focused} onOpen={onOpen} onMark={onMark} />;
          })}
        </ol>
      </section>
    </div>
  );
}
