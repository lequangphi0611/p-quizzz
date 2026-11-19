import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Kbd } from '../../../shared/ui/Kbd.js';
import { mText } from '../../../shared/ui/member/member-shell.js';
import { NavCell } from '../../../shared/ui/member/question-nav.js';

// Pieces that only the exam-taking screen uses.

export function OfflineBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: compact ? '10px 12px' : '10px 24px', background: 'var(--warn-surface)', border: compact ? '1px solid var(--warn-border)' : 0, borderBottom: '1px solid var(--warn-border)', borderRadius: compact ? 'var(--radius-md)' : 0, color: 'var(--warn-600)', font: 'var(--type-ui)', fontSize: 14 }}>
      <Icon name="wifi-off" size={18} style={{ marginTop: 1 }} /><span style={{ minWidth: 0 }}><b>Mất kết nối</b> — bài vẫn được giữ, sẽ lưu lại khi có mạng.</span>
    </div>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const left = total - done;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: 'var(--type-ui)', fontWeight: 600, color: 'var(--text-title)' }}>Đã trả lời <span style={mText.mono}>{done}/{total}</span></span>
        <span style={mText.meta}>{left > 0 ? `Còn ${left} câu` : 'Đủ tất cả'}</span>
      </div>
      <div role="progressbar" aria-label="Tiến độ trả lời" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} style={{ height: 6, borderRadius: 99, background: 'var(--ink-100)', overflow: 'hidden' }}>
        <div style={{ width: (total ? (done / total) * 100 : 0) + '%', height: '100%', borderRadius: 99, background: 'var(--brand-600)', transition: 'width var(--dur-slow) var(--ease-standard)' }} />
      </div>
    </div>
  );
}

/** Phone bottom sheet: all questions in a 5-column grid, progress and the submit button. */
export function NavSheet({ count, current, answered, needsReason = [], onSelect, onClose, onSubmit }: { count: number; current: number; answered: number[]; needsReason?: number[]; onSelect: (i: number) => void; onClose: () => void; onSubmit: () => void }) {
  const set = new Set(answered);
  const missing = new Set(needsReason);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--scrim)', display: 'flex', alignItems: 'flex-end', animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}>
      <div role="dialog" aria-modal="true" aria-label="Danh sách câu" style={{ width: '100%', background: 'var(--paper)', borderRadius: '20px 20px 0 0', padding: '8px 16px calc(16px + env(safe-area-inset-bottom))', boxShadow: 'var(--shadow-dialog)', display: 'grid', gap: 16, animation: 'pq-reveal var(--dur-slow) var(--ease-standard)', boxSizing: 'border-box' }}>
        <span aria-hidden="true" style={{ justifySelf: 'center', width: 36, height: 4, borderRadius: 99, background: 'var(--ink-300)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)' }}>Danh sách câu</h2>
          <Button variant="ghost" size="lg" icon="x" ariaLabel="Đóng" onClick={onClose} style={{ width: 44, height: 44 }} />
        </div>
        <Progress done={answered.length} total={count} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 8 }}>
          {Array.from({ length: count }, (_, i) => <NavCell key={i} i={i} fill cur={i === current} done={set.has(i)} needsReason={missing.has(i)} onSelect={j => { onSelect(j); onClose(); }} />)}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', ...mText.meta }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--brand-100)', border: '1.5px solid var(--brand-200)' }} />Đã trả lời</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px dashed var(--ink-400)' }} />Chưa trả lời</span>
          {missing.size > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--warn-surface)', border: '1.5px solid var(--warn-border)' }} />Thiếu lý do</span>}
        </div>
        <Button size="lg" block icon="send" onClick={() => { onClose(); onSubmit(); }}>Nộp bài</Button>
      </div>
    </div>
  );
}

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows: [string[], string][] = [[['←', '→'], 'Câu trước / câu sau'], [['1', '…', '9'], 'Chọn phương án (nhiều đáp án: bật / tắt)'], [['↑', '↓'], 'Di chuyển giữa các phương án'], [['Esc'], 'Thoát ô nhập để dùng lại phím tắt'], [['?'], 'Mở bảng này']];
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16, animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}>
      <div role="dialog" aria-modal="true" aria-label="Phím tắt" style={{ width: '100%', maxWidth: 440, background: 'var(--paper)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-dialog)', padding: 24, display: 'grid', gap: 16, animation: 'pq-pop-in var(--dur-slow) var(--ease-standard)', boxSizing: 'border-box' }}>
        <h3 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)' }}>Phím tắt</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map(([keys, text]) => (
            <div key={text} style={{ display: 'grid', gridTemplateColumns: '112px minmax(0,1fr)', gap: 12, alignItems: 'center', font: 'var(--type-ui)', fontSize: 14, color: 'var(--text-body)' }}>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{keys.map((key, j) => (key === '…' ? <span key={j} style={mText.meta}>–</span> : <Kbd key={j}>{key}</Kbd>))}</span><span>{text}</span>
            </div>
          ))}
        </div>
        <p style={{ ...mText.meta, display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          <Icon name="info" size={16} style={{ marginTop: 2 }} /><span>Phím tắt tạm tắt khi con trỏ đang ở ô nhập (ô tự luận, ô tên…). Nộp bài không có phím tắt để tránh bấm nhầm.</span>
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button variant="secondary" shortcut="Esc" onClick={onClose}>Đóng</Button></div>
      </div>
    </div>
  );
}

/**
 * 00:00 (PRODUCT.md §7.27g): covers the questions so nobody keeps typing into a closed attempt. The session closes
 * itself a few seconds later and the result screen replaces this one.
 */
export function TimeUpOverlay({ saving }: { saving: boolean }) {
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="pq-time-up" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 20, 30, 0.55)' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center', padding: 28, background: 'var(--paper)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-raised)' }}>
        <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--wrong-surface)', color: 'var(--wrong-600)' }}><Icon name="hourglass" size={28} /></span>
        <h2 id="pq-time-up" style={{ ...mText.h1, fontSize: 24 }}>Đã hết giờ</h2>
        <p style={mText.meta}>{saving ? 'Đang gửi nốt các câu trả lời cuối…' : 'Bài của bạn đã được lưu và sẽ được nộp tự động.'} Kết quả hiện ngay khi phiên đóng.</p>
        <Icon name="loader-circle" size={20} spin />
      </div>
    </div>
  );
}
