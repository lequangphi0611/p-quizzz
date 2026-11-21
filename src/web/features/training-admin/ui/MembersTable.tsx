import { useRef } from 'react';
import type { TrainingMemberRow } from '../../../../shared/api/index.js';
import { Card } from '../../../shared/ui/Card.js';
import { td, th } from '../../../shared/ui/tableStyles.js';
import { connectionLabel } from '../domain/connection-label.js';
import { formatLastSeen, sortMembers } from '../domain/members.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConnectionChip, StoppedSendingChip, StuckChip } from './chips.js';

const tight = { padding: '10px 10px' } as const;
const num = { ...td, ...tight, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' } as const;

/**
 * The members of a training, sorted by name and kept that way: no column sorts by errors, there is no score or rank.
 * Choosing a member (click, or ↑ / ↓ then Enter) opens their timeline. `compact` = the output panel is open: names only.
 * The table is not a live region; changes are announced separately (see `announcementFor`).
 */
export function MembersTable({ members, selectedId, onSelect, onPurge, compact, now }: { members: readonly TrainingMemberRow[]; selectedId: number | null; onSelect: (id: number) => void; onPurge: (id: number) => void; compact: boolean; now: number }) {
  const body = useRef<HTMLTableSectionElement>(null);
  const rows = sortMembers(members);

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    const buttons = [...(body.current?.querySelectorAll<HTMLButtonElement>('button[data-member]') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    buttons[Math.min(buttons.length - 1, Math.max(0, at + step))]?.focus();
  }

  return (
    <Card padding={0} style={{ minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table aria-label="Học viên" style={{ width: '100%', borderCollapse: 'collapse' }}>
          {!compact && (
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-card)', zIndex: 1 }}>
              <tr><th style={{ ...th, ...tight }}>Học viên</th><th style={{ ...th, ...tight }}>Kết nối</th><th style={{ ...th, ...tight, textAlign: 'right' }}>Prompt</th><th style={{ ...th, ...tight, textAlign: 'right' }}>Lệnh</th><th style={{ ...th, ...tight, textAlign: 'right' }}>Lỗi</th><th style={{ ...th, ...tight }}>Lần cuối</th></tr>
            </thead>
          )}
          <tbody ref={body} onKeyDown={onKeyDown}>
            {rows.map(m => {
              const on = m.id === selectedId;
              return (
                <tr key={m.id} onClick={() => onSelect(m.id)} style={{ cursor: 'pointer', background: on ? 'var(--selected-bg)' : undefined, boxShadow: on ? 'inset 3px 0 0 var(--brand-600)' : undefined }}>
                  <td style={{ ...td, ...tight, whiteSpace: 'normal', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" data-member={m.id} aria-pressed={on} onClick={e => { e.stopPropagation(); onSelect(m.id); }}
                        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'var(--type-ui)', fontWeight: 600, color: 'var(--text-title)', textAlign: 'left', overflowWrap: 'anywhere' }}>{m.displayName}</button>
                      {m.stuck && <StuckChip iconOnly={compact} />}
                      {m.stoppedSending && connectionLabel(m).key !== 'stopped-sending' && <StoppedSendingChip iconOnly={compact} />}
                      {compact && <ConnectionChip row={m} iconOnly />}
                    </div>
                    {m.stoppedSending && (
                      <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" icon="trash-2" onClick={() => onPurge(m.id)}>Duyệt xoá</Button>
                      </div>
                    )}
                  </td>
                  {!compact && (
                    <>
                      <td style={{ ...td, ...tight }}><ConnectionChip row={m} /></td>
                      <td style={num}>{m.promptCount}</td>
                      <td style={num}>{m.toolCount}</td>
                      <td style={num}>{m.failedCount}</td>
                      <td style={{ ...td, ...tight, color: 'var(--text-meta)', fontVariantNumeric: 'tabular-nums' }}>{formatLastSeen(m.lastSeenAt, now)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
