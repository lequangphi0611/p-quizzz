import { useState } from 'react';
import type { SessionDetail } from '../../../../shared/api/index.js';
import { MAX_READY_MIN } from '../../../../shared/session-start.js';
import { formatCountdown } from '../../../shared/format/countdown.js';
import { countReasonOf } from '../../../shared/format/start.js';
import { useCountdown } from '../../../shared/hooks/useCountdown.js';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Switch } from '../../../shared/ui/member/Switch.js';
import { GoRing, ReadyMeter } from '../../../shared/ui/start/StartParts.js';
import { autoStartBlockers, defaultReadyMin, nextOccurrence, scheduleLabel, toTimeInput } from '../domain/start-ui.js';

const meta = { margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' } as const;
const colLabel = { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-meta)' } as const;
const COUNT_WHY = { mentor: 'bạn bấm Bắt đầu ngay', early: 'bạn bấm Bắt đầu ngay, sớm hơn giờ hẹn', all: 'tất cả đã sẵn sàng' } as const;

/**
 * How the session starts (PRODUCT.md §7.31, Design System 7 A12): the scheduled time, "Tự bắt đầu khi tất cả sẵn sàng"
 * with its minimum and why it has not fired yet, and "Bắt đầu ngay". While the 10-second countdown runs, only "Huỷ".
 * Draft and lobby only: once running the card is gone.
 */
export function StartCard({ detail, working, onSchedule, onAutoStart, onStartNow, onCancel }: {
  detail: SessionDetail; working: boolean;
  onSchedule: (startsAt: number | null) => void; onAutoStart: (enabled: boolean, min: number) => void; onStartNow: () => void; onCancel: () => void;
}) {
  const s = detail.start;
  const left = useCountdown(s ? { remainingMs: s.startsInMs, endsAt: s.startsAt } : null);
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState('');
  const [min, setMin] = useState<number | null>(null);
  if (!s) return null;
  const lobby = detail.status === 'lobby';
  const now = new Date();
  const counting = s.countdownEndsAt !== null;
  const readyMin = min ?? s.readyMin ?? defaultReadyMin(detail);
  const blockers = lobby ? autoStartBlockers(detail) : [];
  const picked = nextOccurrence(time, now);

  const badge = counting
    ? <span style={pill('var(--brand-050)', 'var(--brand-700)', 'var(--brand-200)')}><Icon name="play" size={12} />Đang đếm ngược</span>
    : s.scheduledAt !== null
      ? <span style={pill('var(--sun-100)', 'var(--sun-ink)', 'var(--sun-300)')}><Icon name="calendar" size={12} />{s.autoStartReady ? 'Tự bắt đầu' : 'Bắt đầu'} lúc {scheduleLabel(s.scheduledAt, now)} · còn {left !== null ? formatCountdown(left) : '––:––'}</span>
      : s.autoStartReady ? <span style={pill('var(--ink-100)', 'var(--ink-700)', 'var(--ink-300)')}><Icon name="users" size={12} />Tự bắt đầu khi tất cả sẵn sàng</span> : null;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 20px', borderBottom: '1px solid var(--border-hairline)' }}>
      <span style={{ font: '700 16px/1.3 var(--font-sans)', color: 'var(--text-title)' }}>Bắt đầu</span>
      {badge}
      {lobby && <span style={{ marginLeft: 'auto', minWidth: 180 }}><ReadyMeter ready={s.ready.count} total={s.ready.total} size="sm" /></span>}
    </div>
  );

  if (counting) {
    const n = Math.ceil((left ?? 0) / 1000);
    return (
      <section aria-label="Bắt đầu" style={card}>
        {header}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', padding: '18px 20px', background: 'var(--brand-050)' }}>
          <GoRing n={n} d={76} tone="light" />
          <div style={{ flex: '1 1 260px', display: 'grid', gap: 4 }}>
            <b style={{ font: '700 18px/1.3 var(--font-sans)', color: 'var(--text-title)' }}>Phiên bắt đầu sau {n} giây</b>
            <p style={meta}>Lý do: {COUNT_WHY[countReasonOf(s)]}{countReasonOf(s) === 'all' ? ` (${s.ready.count}/${s.ready.total})` : ''}. Học viên và màn chiếu đang thấy đếm ngược.</p>
          </div>
          <Button variant="secondary" size="lg" icon="x" disabled={working} onClick={onCancel}>Huỷ (còn {n} giây)</Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Bắt đầu" style={card}>
      {header}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={{ ...col, borderRight: '1px solid var(--border-hairline)' }}>
          <span style={colLabel}>Giờ hẹn</span>
          {editing || s.scheduledAt === null ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <input type="time" aria-label="Giờ bắt đầu" value={time || (s.scheduledAt !== null ? toTimeInput(s.scheduledAt) : '')} disabled={working} onChange={e => setTime(e.target.value)}
                style={{ width: 140, height: 40, padding: '0 10px', font: 'var(--type-body)', fontSize: 18, color: 'var(--text-title)', background: 'var(--paper)', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)' }} />
              {picked && <span style={meta}>Bắt đầu lúc {scheduleLabel(picked.getTime(), now)}{lobby ? '' : ' (khi phòng chờ đang mở)'}</span>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" icon="calendar" disabled={working || !picked} onClick={() => { if (picked) { onSchedule(picked.getTime()); setEditing(false); setTime(''); } }}>{s.scheduledAt === null ? 'Hẹn giờ' : 'Lưu giờ mới'}</Button>
                {editing && <Button size="sm" variant="ghost" disabled={working} onClick={() => { setEditing(false); setTime(''); }}>Huỷ</Button>}
              </div>
              {s.scheduledAt === null && !editing && <span style={meta}>Không hẹn: bạn tự bấm Bắt đầu ngay.</span>}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <b style={{ font: '800 36px/1 var(--font-sans)', color: 'var(--text-title)' }}>{scheduleLabel(s.scheduledAt, now)}</b>
                <span style={{ ...meta, fontFamily: 'var(--font-mono)' }}>còn {left !== null ? formatCountdown(left) : '––:––'}</span>
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" variant="secondary" icon="pencil" disabled={working} onClick={() => { setTime(toTimeInput(s.scheduledAt!)); setEditing(true); }}>Đổi giờ</Button>
                <Button size="sm" variant="ghost" icon="x" disabled={working} onClick={() => onSchedule(null)}>Bỏ hẹn</Button>
              </div>
            </div>
          )}
        </div>
        <div style={{ ...col, borderRight: '1px solid var(--border-hairline)' }}>
          <Switch on={s.autoStartReady} onChange={v => onAutoStart(v, readyMin)}>Tự bắt đầu khi tất cả sẵn sàng</Switch>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: 'var(--type-ui)', fontSize: 14, color: 'var(--text-body)' }}>
            Tối thiểu
            <span style={{ display: 'inline-flex', alignItems: 'center', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)', height: 36 }}>
              <button type="button" aria-label="Bớt một người" disabled={working || readyMin <= 1} onClick={() => step(-1)} style={stepBtn}><Icon name="minus" size={14} /></button>
              <span aria-live="polite" style={{ minWidth: 36, textAlign: 'center', font: '700 16px/1 var(--font-mono)', color: 'var(--text-title)' }}>{readyMin}</span>
              <button type="button" aria-label="Thêm một người" disabled={working || readyMin >= MAX_READY_MIN} onClick={() => step(1)} style={stepBtn}><Icon name="plus" size={14} /></button>
            </span>
            người
          </label>
          {blockers.length > 0 && (
            <div style={{ display: 'grid', gap: 6, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
              <span style={colLabel}>Chưa tự chạy được</span>
              {blockers.map(b => <span key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-meta)', color: 'var(--text-body)' }}><Icon name={b.icon} size={14} color="var(--ink-600)" />{b.text}</span>)}
            </div>
          )}
          {!s.autoStartReady && <p style={meta}>Bật lên thì khi đủ người và ai cũng bấm Sẵn sàng, cả phòng đếm ngược 10 giây rồi vào bài.</p>}
        </div>
        <div style={col}>
          {lobby
            ? <>
              <Button size="lg" icon="play" disabled={working} onClick={onStartNow}>Bắt đầu ngay</Button>
              <p style={meta}>Cả phòng đếm ngược 10 giây rồi vào câu 1.{s.scheduledAt !== null ? ' Trước giờ hẹn sẽ hỏi lại.' : ''}</p>
            </>
            : <p style={meta}>Mở phòng chờ để học viên vào. Giờ hẹn chỉ có tác dụng khi phòng chờ đang mở.</p>}
        </div>
      </div>
    </section>
  );

  function step(by: number) {
    const next = Math.min(MAX_READY_MIN, Math.max(1, readyMin + by));
    setMin(next);
    if (s!.autoStartReady) onAutoStart(true, next);
  }
}

const card = { background: 'var(--paper)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', width: '100%' } as const;
const col = { display: 'grid', gap: 12, alignContent: 'start', padding: '16px 20px' } as const;
const stepBtn = { width: 34, height: '100%', display: 'grid', placeItems: 'center', border: 0, background: 'none', color: 'var(--ink-700)', cursor: 'pointer' } as const;
const pill = (bg: string, ink: string, border: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: bg, color: ink, border: `1px solid ${border}`, font: 'var(--type-label)', whiteSpace: 'nowrap' }) as const;
