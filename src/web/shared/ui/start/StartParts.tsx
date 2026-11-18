import type { CSSProperties, ReactNode } from 'react';
import { formatCountdown } from '../../format/countdown.js';
import { formatClockTime, type CountReason, type StartNotice, type StartRule } from '../../format/start.js';
import { Icon } from '../Icon.js';

// The start of a session (PRODUCT.md §7.31), as drawn in Design System 7 "Phòng chờ mới & bắt đầu phiên". Three clocks
// must never look alike: (a) until the start: a dashed amber card with the time as its main text; (b) the 10-second
// countdown: a ring with one big digit; (c) the exam clock (`Countdown`), which only exists once the session runs.

export type StartSize = 'sm' | 'md' | 'screen';
const mono: CSSProperties = { fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' };
const label: CSSProperties = { textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)' };

/** (a) Until the scheduled start: the time is the main text, the countdown second. "Not started yet" reads from the dashes. */
export function StartClock({ at, leftMs, size = 'md', changed = false, offline = false, limitMinutes = null, note = true }: { at: number; leftMs: number | null; size?: StartSize; changed?: boolean; offline?: boolean; limitMinutes?: number | null; note?: boolean }) {
  const scr = size === 'screen';
  const z = { sm: [40, 20, 12, '14px 16px', 15, 4], md: [52, 22, 12, '18px 20px', 16, 6], screen: [176, 64, 28, '36px 44px', 34, 14] }[size] as [number, number, number, string, number, number];
  const left = offline || leftMs === null ? '––:––' : formatCountdown(leftMs);
  const time = formatClockTime(at);
  return (
    <div role="timer" aria-live="off" aria-label={`Bắt đầu lúc ${time}${offline ? '' : `, còn ${left}`}`}
      style={{ display: 'grid', gap: z[5], padding: z[3], borderRadius: scr ? 'var(--radius-xl)' : 'var(--radius-lg)', border: `${scr ? 3 : 1.5}px dashed ${scr ? 'var(--sun-400)' : 'var(--sun-500)'}`, background: scr ? 'var(--screen-pending-surface)' : 'var(--sun-100)', color: scr ? 'var(--sun-400)' : 'var(--sun-ink)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: scr ? 14 : 6, font: `600 ${z[2]}px/1.2 var(--font-sans)`, ...label }}>
        <Icon name="calendar" size={z[4]} />Bắt đầu lúc
        {changed && <span style={{ marginLeft: 'auto', padding: scr ? '6px 18px' : '2px 8px', borderRadius: 'var(--radius-pill)', background: scr ? 'var(--sun-400)' : 'var(--ink-900)', color: scr ? 'var(--ink-900)' : '#fff', fontSize: scr ? 24 : 11, letterSpacing: 0, textTransform: 'none', animation: 'pq-pop-in var(--dur-pop) var(--ease-pop)' }}>Vừa đổi</span>}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: scr ? 40 : 14, flexWrap: 'wrap' }}>
        <span key={at} style={{ font: `800 ${z[0]}px/1 var(--font-sans)`, letterSpacing: '-0.03em', color: scr ? '#fff' : 'var(--ink-900)', animation: changed ? 'pq-pop-in var(--dur-pop) var(--ease-pop)' : 'none' }}>{time}</span>
        <span style={{ font: `500 ${z[1]}px/1 var(--font-sans)`, color: scr ? 'var(--sun-400)' : 'var(--sun-ink)', whiteSpace: 'nowrap' }}>còn <b style={{ ...mono, fontWeight: 700 }}>{left}</b></span>
      </span>
      {note && <span style={{ font: `400 ${scr ? 26 : 13}px/1.4 var(--font-sans)`, color: scr ? 'var(--screen-meta)' : 'var(--sun-ink)' }}>{offline ? 'Đang chờ mạng để cập nhật số đếm.' : limitMinutes !== null ? `Chưa tính giờ làm bài — ${limitMinutes} phút chỉ chạy từ lúc bắt đầu.` : 'Câu hỏi hiện ra khi phiên bắt đầu.'}</span>}
    </div>
  );
}

/** No scheduled time: the same place, without a number. */
export function NoSchedule({ size = 'md', limited = false }: { size?: StartSize; limited?: boolean }) {
  const scr = size === 'screen';
  return (
    <div style={{ display: 'grid', gap: scr ? 14 : 4, padding: scr ? '36px 44px' : '16px 20px', borderRadius: scr ? 'var(--radius-xl)' : 'var(--radius-lg)', background: scr ? 'var(--screen-bg)' : 'var(--surface-sunken)', border: scr ? '2px solid var(--screen-line)' : 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: scr ? 16 : 8, font: `${scr ? '800 64px' : '700 22px'}/1.15 var(--font-sans)`, color: scr ? '#fff' : 'var(--text-title)' }}><Icon name="user" size={scr ? 52 : 20} />Chờ mentor bắt đầu</span>
      <span style={{ font: `400 ${scr ? 28 : 13}px/1.4 var(--font-sans)`, color: scr ? 'var(--screen-meta)' : 'var(--text-meta)' }}>Chưa có giờ hẹn.{limited ? ' Giờ làm bài chỉ chạy từ lúc bắt đầu.' : ''}</span>
    </div>
  );
}

/** (b) The 10-second countdown: a ring and one big digit. With reduced motion the ring is 10 cells that switch off one by one. */
export function GoRing({ n, total = 10, d = 200, tone = 'onBrand', reduced = false, center }: { n: number; total?: number; d?: number; tone?: 'onBrand' | 'screen' | 'light'; reduced?: boolean; center?: string }) {
  const s = Math.max(8, Math.round(d * 0.07));
  const r = (d - s) / 2;
  const C = 2 * Math.PI * r;
  const c = d / 2;
  const col = { onBrand: ['rgba(255,255,255,.22)', '#fff', '#fff'], screen: ['var(--screen-line)', 'var(--brand-500)', '#fff'], light: ['var(--brand-100)', 'var(--brand-600)', 'var(--ink-900)'] }[tone];
  const seg = C / total;
  const gap = Math.max(4, d * 0.02);
  return (
    <div role="timer" aria-live="off" aria-label={center ?? `Bắt đầu sau ${n} giây`} style={{ position: 'relative', width: d, height: d, flex: 'none' }}>
      <svg width={d} height={d} aria-hidden="true" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        {reduced
          ? Array.from({ length: total }, (_, i) => <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={i < n ? col[1] : col[0]} strokeWidth={s} strokeDasharray={`${seg - gap} ${C}`} transform={`rotate(${(i * 360) / total} ${c} ${c})`} />)
          : <>
            <circle cx={c} cy={c} r={r} fill="none" stroke={col[0]} strokeWidth={s} />
            <circle cx={c} cy={c} r={r} fill="none" stroke={col[1]} strokeWidth={s} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - n / total)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </>}
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: `800 ${Math.round(d * (center ? 0.16 : 0.5))}px/1 var(--font-sans)`, color: col[2], fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{center ?? n}</span>
    </div>
  );
}

export const COUNT_REASON: Record<CountReason, [string, string]> = {
  mentor: ['user', 'Mentor bắt đầu'],
  all: ['users', 'Tất cả đã sẵn sàng'],
  early: ['play', 'Mentor đã bắt đầu sớm'],
};

/** "Sẵn sàng X/Y": a bar in cells for up to 12 people, a plain bar above that. */
export function ReadyMeter({ ready, total, size = 'md' }: { ready: number; total: number; size?: StartSize }) {
  const scr = size === 'screen';
  const cells = total > 0 && total <= 12;
  const on = scr ? 'var(--screen-correct)' : 'var(--correct-500)';
  const off = scr ? 'var(--screen-bar-track)' : 'var(--ink-200)';
  return (
    <div style={{ display: 'grid', gap: scr ? 16 : 8 }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: scr ? 20 : 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: scr ? 12 : 6, alignSelf: 'center', font: `600 ${scr ? 32 : 15}px/1.2 var(--font-sans)`, color: scr ? '#fff' : 'var(--text-title)' }}><Icon name="user-check" size={scr ? 34 : 17} color={scr ? 'var(--screen-correct)' : 'var(--correct-600)'} />Sẵn sàng</span>
        <b aria-label={`${ready} trên ${total} người sẵn sàng`} style={{ font: `700 ${scr ? 72 : size === 'sm' ? 18 : 24}px/1 var(--font-mono)`, color: scr ? '#fff' : 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{ready}<span style={{ color: scr ? 'var(--screen-meta)' : 'var(--ink-500)', fontSize: '0.66em' }}>/{total}</span></b>
      </span>
      <span aria-hidden="true" style={{ display: 'flex', gap: cells ? (scr ? 8 : 4) : 0, height: scr ? 16 : 8, borderRadius: 99, overflow: 'hidden', background: cells ? 'none' : off }}>
        {cells
          ? Array.from({ length: total }, (_, i) => <span key={i} style={{ flex: 1, borderRadius: 99, background: i < ready ? on : off, transition: 'background var(--dur-base)' }} />)
          : <span style={{ width: `${total > 0 ? (ready / total) * 100 : 0}%`, background: on, borderRadius: 99 }} />}
      </span>
    </div>
  );
}

/** "Đã vào X/N" of a session limited to a list of emails: deliberately unlike "Sẵn sàng" (mail icon, no bar). */
export function JoinedStat({ joined, total, size = 'md' }: { joined: number; total: number; size?: StartSize }) {
  const scr = size === 'screen';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: scr ? 16 : 8, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: scr ? 10 : 6, alignSelf: 'center', font: `600 ${scr ? 28 : 13}px/1.2 var(--font-sans)`, color: scr ? 'var(--screen-meta)' : 'var(--text-meta)' }}><Icon name="mail" size={scr ? 28 : 14} />Đã vào</span>
      <b style={{ font: `700 ${scr ? 48 : 15}px/1 var(--font-mono)`, color: scr ? '#fff' : 'var(--text-title)' }}>{joined}/{total}</b>
      <span style={{ font: scr ? '400 26px/1.2 var(--font-sans)' : 'var(--type-meta)', color: scr ? 'var(--screen-meta)' : 'var(--text-meta)' }}>theo danh sách email</span>
    </span>
  );
}

/**
 * Who decides the start, always right under "Sẵn sàng X/Y" (PRODUCT.md §7.31d). When the big start card already shows
 * the time (`timeShown`), the scheduled line is not repeated.
 */
export function WhoLine({ rule, at, leftMs, min, size = 'md', offline = false, timeShown = false }: { rule: StartRule; at: number | null; leftMs: number | null; min: number | null; size?: StartSize; offline?: boolean; timeShown?: boolean }) {
  const scr = size === 'screen';
  const st: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: scr ? 14 : 8, font: `500 ${scr ? 32 : 14}px/1.3 var(--font-sans)`, color: scr ? '#fff' : 'var(--text-body)' };
  const ic = (n: string) => <Icon name={n} size={scr ? 32 : 16} style={{ marginTop: 2, flex: 'none' }} color={scr ? 'var(--screen-meta)' : 'var(--ink-600)'} />;
  const scheduled = rule === 'scheduled' || rule === 'auto';
  const auto = rule === 'auto' || rule === 'manualAuto';
  let first: ReactNode = null;
  if (!scheduled) first = <span style={st}>{ic('user')}<span>Chờ mentor bắt đầu</span></span>;
  else if (!timeShown && at !== null) first = <span style={st}>{ic('calendar')}<span>Bắt đầu lúc <b>{formatClockTime(at)}</b> · còn <b style={mono}>{offline || leftMs === null ? '––:––' : formatCountdown(leftMs)}</b></span></span>;
  if (!first && !auto) return null;
  return (
    <div style={{ display: 'grid', gap: scr ? 8 : 4 }} aria-label="Cách bắt đầu">
      {first}
      {auto && <span style={{ ...st, color: scr ? 'var(--screen-meta)' : 'var(--text-meta)' }}>{ic('users')}<span>{first || !scheduled ? '… hoặc khi tất cả sẵn sàng' : 'Hoặc sớm hơn, khi tất cả sẵn sàng'}{min ? ` (tối thiểu ${min} người)` : ''}</span></span>}
    </div>
  );
}

const NOTICE_KIND: Record<StartNotice['kind'], [string, string, string, string, string]> = {
  time: ['calendar', 'var(--brand-050)', 'var(--brand-200)', 'var(--brand-700)', 'var(--screen-focus)'],
  cleared: ['calendar', 'var(--ink-100)', 'var(--ink-300)', 'var(--ink-800)', 'var(--screen-meta)'],
  cancel: ['rotate-ccw', 'var(--warn-surface)', 'var(--warn-border)', 'var(--warn-600)', 'var(--sun-400)'],
};

/** Change notices: at most 2 cards, older ones folded into "+N thông báo trước". Read out politely once each. */
export function NoticeStack({ items, size = 'md', onDismiss }: { items: StartNotice[]; size?: StartSize; onDismiss?: (id: number) => void }) {
  if (items.length === 0) return null;
  const scr = size === 'screen';
  const older = items.length - 2;
  const time = (at: number) => formatClockTime(at);
  return (
    <div aria-label="Thông báo" aria-live="polite" style={{ display: 'grid', gap: scr ? 16 : 8 }}>
      {items.slice(0, 2).map(it => {
        const k = NOTICE_KIND[it.kind];
        if (scr) {
          return (
            <div key={it.id} role="status" style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '24px 36px', borderRadius: 'var(--radius-lg)', background: 'var(--screen-panel)', border: `3px solid ${k[4]}`, animation: 'pq-reveal var(--dur-slow) var(--ease-standard)' }}>
              <Icon name={k[0]} size={48} color={k[4]} />
              <span style={{ display: 'grid', gap: 6, flex: 1, minWidth: 0 }}><b style={{ font: '700 44px/1.2 var(--font-sans)', color: '#fff' }}>{it.title}</b>{it.sub && <span style={{ font: '400 30px/1.3 var(--font-sans)', color: 'var(--screen-meta)' }}>{it.sub}</span>}</span>
              {it.count > 1 && <span style={{ padding: '8px 20px', borderRadius: 'var(--radius-pill)', background: 'var(--screen-bg)', border: '2px solid var(--screen-line-strong)', font: '600 26px/1 var(--font-sans)', color: '#fff', whiteSpace: 'nowrap' }}>đổi {it.count} lần</span>}
              <span style={{ font: '500 28px/1 var(--font-mono)', color: 'var(--screen-meta)' }}>{time(it.at)}</span>
            </div>
          );
        }
        return (
          <div key={it.id} role="status" style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 10, alignItems: 'start', padding: '12px 12px 12px 14px', borderRadius: 'var(--radius-md)', background: k[1], border: `1px solid ${k[2]}`, color: k[3], animation: 'pq-reveal var(--dur-slow) var(--ease-standard)' }}>
            <Icon name={k[0]} size={18} style={{ marginTop: 1 }} />
            <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <b style={{ font: '700 15px/1.35 var(--font-sans)' }}>{it.title}</b>
                {it.count > 1 && <span key={it.count} style={{ padding: '1px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--paper)', border: `1px solid ${k[2]}`, font: 'var(--type-label)', animation: 'pq-pop-in var(--dur-pop) var(--ease-pop)' }}>đổi {it.count} lần</span>}
              </span>
              {it.sub && <span style={{ font: 'var(--type-meta)', color: 'var(--text-body)' }}>{it.sub}</span>}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ ...mono, fontSize: 12, color: 'var(--text-faint)' }}>{time(it.at)}</span>
              {onDismiss && <button type="button" aria-label="Đóng thông báo" onClick={() => onDismiss(it.id)} style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', border: 0, background: 'none', color: 'inherit', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}><Icon name="x" size={16} /></button>}
            </span>
          </div>
        );
      })}
      {older > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4, font: `400 ${scr ? 26 : 13}px/1.4 var(--font-sans)`, color: scr ? 'var(--screen-meta)' : 'var(--text-meta)' }}><Icon name="chevron-down" size={scr ? 24 : 14} />+{older} thông báo trước</span>}
    </div>
  );
}
