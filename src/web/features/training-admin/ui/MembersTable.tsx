import { useRef } from 'react';
import type { TrainingMemberRow } from '../../../../shared/api/index.js';
import { Card } from '../../../shared/ui/Card.js';
import { td, th } from '../../../shared/ui/tableStyles.js';
import { connectionLabel } from '../domain/connection-label.js';
import { visibleFlags } from '../domain/flags.js';
import { formatLastSeen, sortMembers } from '../domain/members.js';
import { unreadPromptCount, type ReadState } from '../domain/unread.js';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { memberDraftSpeech } from '../domain/example-draft.js';
import { ConnectionChip, FlagChip, visuallyHidden } from './chips.js';
import { DraftChips } from './DraftChips.js';
import { NewBadge } from './NewBadge.js';

const tight = { padding: '10px 6px' } as const;
const numTight = { padding: '10px 4px' } as const;
const num = { ...td, ...numTight, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' } as const;

/**
 * The members of a training, sorted by name and kept that way: no column sorts by errors, there is no score or rank.
 * Choosing a member (click, or ↑ / ↓ then Enter) opens their timeline. `compact` = the output panel is open: names only.
 * The table is not a live region; changes are announced separately (see `announcementFor`).
 * Beside a name, "N mới" counts the prompts not read yet (S43); not shown while the content is hidden, as it could tell the room who is active.
 */
export function MembersTable({ members, selectedId, onSelect, onPurge, compact, now, read, hidden }: { members: readonly TrainingMemberRow[]; selectedId: number | null; onSelect: (id: number) => void; onPurge: (id: number) => void; compact: boolean; now: number; read: ReadState; hidden: boolean }) {
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
              <tr><th style={{ ...th, ...tight }}>Học viên</th><th style={{ ...th, ...tight }}>Kết nối</th><th style={{ ...th, ...numTight, textAlign: 'right' }}>Prompt</th><th style={{ ...th, ...numTight, textAlign: 'right' }}>Lệnh</th><th style={{ ...th, ...numTight, textAlign: 'right' }}>Lỗi</th><th style={{ ...th, ...tight }}>Cờ gợi ý</th><th style={{ ...th, ...tight }}>Lần cuối</th></tr>
            </thead>
          )}
          <tbody ref={body} onKeyDown={onKeyDown}>
            {rows.map(m => {
              const on = m.id === selectedId;
              const fresh = hidden ? 0 : unreadPromptCount(m, read);
              const key = connectionLabel(m).key;
              // The learner's state is a secondary line under the name, not a chip beside it (S43 design). The wide table has a connection column, so it repeats nothing there.
              const status = [
                m.stuck && { icon: 'hourglass', text: 'có thể đang kẹt' },
                m.stoppedSending && (compact || key !== 'stopped-sending') && { icon: 'log-out', text: 'đã dừng gửi' },
                compact && key === 'waiting' && { icon: 'circle-dot', text: 'chưa nhận tín hiệu' },
              ].filter((x): x is { icon: string; text: string } => !!x);
              const badge = fresh > 0 && (
                <span data-member-new={m.id} style={{ marginLeft: 'auto', flex: 'none' }}>
                  <span id={`member-new-${m.id}`} style={visuallyHidden}>{fresh} prompt có mục mới</span>
                  <span aria-hidden="true"><NewBadge count={fresh} size="md" /></span>
                </span>
              );
              const speech = memberDraftSpeech(m.exampleDrafts);
              const describedBy = [fresh > 0 ? `member-new-${m.id}` : '', speech ? `member-drafts-${m.id}` : ''].filter(Boolean).join(' ') || undefined;
              return (
                <tr key={m.id} onClick={() => onSelect(m.id)} style={{ cursor: 'pointer', background: on ? 'var(--selected-bg)' : undefined, boxShadow: on ? 'inset 3px 0 0 var(--brand-600)' : undefined }}>
                  <td style={{ ...td, ...tight, whiteSpace: 'normal', minWidth: compact ? 0 : 132 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" data-member={m.id} aria-pressed={on} aria-describedby={describedBy} onClick={e => { e.stopPropagation(); onSelect(m.id); }}
                        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'var(--type-ui)', fontWeight: 600, color: 'var(--text-title)', textAlign: 'left', overflowWrap: 'anywhere' }}>{m.displayName}</button>
                      {speech && <span id={`member-drafts-${m.id}`} style={visuallyHidden}>{speech}</span>}
                      <DraftChips counts={m.exampleDrafts} memberId={m.id} />
                      {compact && key !== 'waiting' && key !== 'stopped-sending' && <ConnectionChip row={m} iconOnly />}
                      {compact && visibleFlags(m).map(code => <FlagChip key={code} code={code} iconOnly />)}
                      {compact && badge}
                    </div>
                    {status.length > 0 && (
                      <div data-member-status={m.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0 10px', marginTop: 2, font: '400 12px/1.35 var(--font-sans)', color: 'var(--ink-600)', whiteSpace: 'nowrap' }}>
                        {status.map(x => <span key={x.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><Icon name={x.icon} size={12} />{x.text}</span>)}
                      </div>
                    )}
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
                      <td style={{ ...td, ...tight, whiteSpace: 'normal', width: 130, maxWidth: 160 }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{visibleFlags(m).map(code => <FlagChip key={code} code={code} wrap />)}</div>
                      </td>
                      <td style={{ ...td, ...tight, color: 'var(--text-meta)', fontVariantNumeric: 'tabular-nums', position: 'sticky', right: 0, background: 'var(--surface-card)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ whiteSpace: 'nowrap' }}>{formatLastSeen(m.lastSeenAt, now)}</span>
                          {badge}
                        </div>
                      </td>
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
