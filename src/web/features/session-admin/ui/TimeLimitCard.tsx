import { useState } from 'react';
import type { SessionDetail } from '../../../../shared/api/index.js';
import { formatMinutes } from '../../../shared/format/countdown.js';
import { useCountdown } from '../../../shared/hooks/useCountdown.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { Countdown } from '../../../shared/ui/Countdown.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { EXTEND_STEPS, chosenTimeLimit, timeLimitHint } from '../domain/time-limit-ui.js';

const meta = { margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' } as const;

/**
 * Time limit (PRODUCT.md §7.27): editable before the start; while running, the shared countdown and "+N phút" for
 * everyone (never shorter); afterwards just what it was.
 */
export function TimeLimitCard({ detail, working, onSave, onExtend }: { detail: SessionDetail; working: boolean; onSave: (minutes: number | null) => void; onExtend: (minutes: number) => void }) {
  const left = useCountdown(detail.timer);
  const editable = detail.status === 'draft' || detail.status === 'lobby';
  return (
    <Card title="Thời gian làm bài">
      {editable ? <Editor key={detail.timeLimitMinutes ?? 'none'} current={detail.timeLimitMinutes} working={working} onSave={onSave} />
        : detail.status === 'running' && left !== null ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Countdown ms={left} size="md" announce={false} />
              <span style={meta}>Tổng {formatMinutes(detail.timeLimitMinutes ?? 0)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EXTEND_STEPS.map(m => <Button key={m} size="sm" variant="secondary" icon="plus" disabled={working} onClick={() => onExtend(m)}>{m} phút</Button>)}
            </div>
            <p style={meta}>Cộng thêm cho cả phòng, mọi người thấy ngay. Hết giờ phiên tự đóng và nộp bài dở, như khi bạn bấm Đóng.</p>
          </div>
        ) : (
          <p style={{ ...meta, color: 'var(--text-body)' }}>
            {detail.timeLimitMinutes === null ? 'Không giới hạn: học viên làm tới khi bạn đóng phiên.' : `Giới hạn ${formatMinutes(detail.timeLimitMinutes)}.`}
          </p>
        )}
    </Card>
  );
}

function Editor({ current, working, onSave }: { current: number | null; working: boolean; onSave: (minutes: number | null) => void }) {
  const [limited, setLimited] = useState(current !== null);
  const [minutes, setMinutes] = useState(String(current ?? 30));
  const value = chosenTimeLimit(limited, minutes);
  const dirty = value !== undefined && value !== current;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <SegmentedControl ariaLabel="Thời gian làm bài" size="sm" value={limited ? 'limited' : 'none'} disabled={working} onChange={v => setLimited(v === 'limited')}
          items={[{ value: 'none', label: 'Không giới hạn' }, { value: 'limited', label: 'Giới hạn' }]} />
        {limited && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', color: 'var(--text-title)' }}>
            <input type="number" inputMode="numeric" min={1} max={300} step={1} value={minutes} disabled={working} onChange={e => setMinutes(e.target.value)} aria-label="Số phút" aria-invalid={value === undefined}
              style={{ width: 80, height: 36, padding: '0 10px', font: 'var(--type-body)', fontSize: 16, color: 'var(--text-title)', background: 'var(--paper)', border: `1.5px solid ${value === undefined ? 'var(--wrong-500)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-md)' }} />
            phút
          </label>
        )}
      </div>
      <p style={{ ...meta, color: limited && value === undefined ? 'var(--wrong-600)' : 'var(--text-meta)' }}>{timeLimitHint(null, limited, minutes)}</p>
      {dirty && <Button size="sm" icon="save" disabled={working} onClick={() => onSave(value)} style={{ justifySelf: 'start' }}>Lưu</Button>}
    </div>
  );
}
