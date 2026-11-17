import type { SessionDetail } from '../../../../shared/api/index.js';
import { formatClock } from '../../../shared/format/date.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { SCORE_VISIBILITY_CHOICES, scoreVisibilityState } from '../domain/score-visibility-ui.js';
import type { ScoreVisibility } from '../../../../shared/api/index.js';

const meta = { margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' } as const;

/**
 * When members see scores (PRODUCT.md §7.25): the switch (only while nobody has submitted), whether scores are held
 * right now, and "Công bố điểm". The mentor always sees every score on this page, whatever the setting.
 */
export function ScoresCard({ detail, working, onChange, onRelease }: { detail: SessionDetail; working: boolean; onChange: (v: ScoreVisibility) => void; onRelease: () => void }) {
  const st = scoreVisibilityState(detail);
  const choice = SCORE_VISIBILITY_CHOICES.find(c => c.value === detail.scoreVisibility)!;
  let status: { icon: string; text: string; color: string };
  if (detail.scoresHidden) status = { icon: 'eye-off', text: `Đang giữ điểm · ${st.submitted} người đã nộp`, color: 'var(--sun-ink)' };
  else if (detail.scoresReleasedAt !== null) status = { icon: 'eye', text: `Đã công bố lúc ${formatClock(detail.scoresReleasedAt)}`, color: 'var(--correct-600)' };
  else status = { icon: 'eye', text: 'Học viên đang thấy điểm và bảng xếp hạng', color: 'var(--text-meta)' };

  return (
    <Card title="Điểm và bảng xếp hạng">
      <div style={{ display: 'grid', gap: 12 }}>
        {st.canChange ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <SegmentedControl ariaLabel="Điểm và bảng xếp hạng" size="sm" value={detail.scoreVisibility} disabled={working} onChange={v => { if (v !== detail.scoreVisibility) onChange(v); }} items={SCORE_VISIBILITY_CHOICES.map(c => ({ value: c.value, label: c.label }))} />
            <p style={meta}>{choice.hint}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ font: 'var(--type-ui)', color: 'var(--text-title)' }}>{choice.label}</span>
            {st.lockedReason && <p style={meta}>{st.lockedReason}</p>}
          </div>
        )}
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', fontSize: 14, color: status.color }}>
          <Icon name={status.icon} size={16} />{status.text}
        </div>
        {st.canRelease && (
          <div style={{ display: 'grid', gap: 6 }}>
            <Button icon="eye" disabled={working} onClick={onRelease}>Công bố điểm</Button>
            <p style={meta}>Nếu bạn quên, điểm cũng tự hiện khi đóng phiên.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
