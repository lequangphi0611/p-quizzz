import { useState } from 'react';
import type { SessionDetail } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { accessLabel, OUTSIDER_CHOICES } from '../domain/access-ui.js';

/**
 * Who may join this session and how the list is doing (roster sessions only): how many of the list are in, who is
 * still missing, and the two exceptions the mentor can make. Emails are shown only here (PRODUCT.md §7.24).
 */
export function AccessCard({ detail, working, onAdd, onSave }: { detail: SessionDetail; working: boolean; onAdd: () => void; onSave: () => void }) {
  const [showMissing, setShowMissing] = useState(false);
  const roster = detail.roster;
  if (detail.access !== 'roster' || !roster) return null;
  const open = detail.status === 'draft' || detail.status === 'lobby' || detail.status === 'running';
  const policy = OUTSIDER_CHOICES.find(o => o.value === detail.outsiderPolicy)!;
  return (
    <Card title="Ai được vào" subtitle={`${accessLabel(detail)} · ${roster.size} email`}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', color: 'var(--text-title)' }}>
          <Icon name="users" size={16} />
          <span>Đã vào <b className="pq-tabular" style={{ fontFamily: 'var(--font-mono)' }}>{roster.joined}/{roster.size}</b></span>
        </div>
        <div style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Người ngoài danh sách: <b>{policy.label}</b>. {policy.hint}</div>

        {roster.notJoined.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            <button type="button" onClick={() => setShowMissing(v => !v)} aria-expanded={showMissing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifySelf: 'start', background: 'none', border: 0, padding: 0, color: 'var(--text-link)', font: 'var(--type-meta)', fontWeight: 600, cursor: 'pointer' }}>
              <Icon name={showMissing ? 'chevron-down' : 'chevron-right'} size={14} />Chưa vào · {roster.notJoined.length}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-meta)', fontWeight: 400 }}><Icon name="eye-off" size={13} />chỉ bạn thấy</span>
            </button>
            {showMissing && (
              <ul aria-label="Email chưa vào" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 200, overflowY: 'auto', font: 'var(--type-code)', fontSize: 13 }}>
                {roster.notJoined.map(e => <li key={e} style={{ padding: '3px 0', overflowWrap: 'anywhere', color: 'var(--text-body)' }}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {open && <Button size="sm" variant="secondary" icon="plus" disabled={working} onClick={onAdd}>Thêm email cho phiên này</Button>}
          {detail.rosterSource === 'temp' && <Button size="sm" variant="secondary" icon="bookmark-plus" disabled={working} onClick={onSave}>Lưu thành nhóm</Button>}
        </div>
      </div>
    </Card>
  );
}
