import { useEffect, useState } from 'react';
import type { SessionDetail } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { formatDate } from '../../../shared/format/date.js';
import { useJoinHost } from '../../../shared/room/join-url.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { useSessionAdminGateway } from '../application/session-admin-context.js';
import { canShare, shareLink, shareWarnings } from '../domain/share-ui.js';
import { useCopy } from './useCopy.js';

const HAS = ['Đề, đáp án và lời giải', 'Tỉ lệ cả lớp chọn từng phương án', 'Đáp án mẫu câu tự luận', 'Tên đề, ngày giờ thi, số bài nộp'];
const HAS_NOT = ['Tên, email học viên', 'Tên phiên, tên nhóm', 'Điểm, bảng xếp hạng', 'Bài làm, bài tự luận, lý do, nhận xét'];
const listTitle = { margin: 0, font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-meta)' } as const;

function Pill({ on }: { on: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 'var(--radius-pill)', font: 'var(--type-label)', background: on ? 'var(--correct-surface)' : 'var(--ink-100)', color: on ? 'var(--correct-600)' : 'var(--ink-700)', border: '1px solid ' + (on ? 'var(--correct-border)' : 'var(--ink-200)') }}>
      <Icon name={on ? 'circle-check' : 'eye-off'} size={13} />{on ? 'Đang chia sẻ' : 'Chưa chia sẻ'}
    </span>
  );
}

// "Chia sẻ phiên này" on the mentor's review page (PRODUCT.md §7.33a, design C9/C10).
export function ShareCard({ session }: { session: SessionDetail }) {
  const gateway = useSessionAdminGateway();
  const { host } = useJoinHost(() => gateway.getJoinHosts());
  const [sharedAt, setSharedAt] = useState(session.sharedAt);
  const [token, setToken] = useState<string | null>(null);
  const [sharedCount, setSharedCount] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { copied, copy } = useCopy();
  const ended = canShare(session.status);
  const on = sharedAt !== null;
  const warn = shareWarnings(session.share);
  const link = token ? shareLink(host, token) : '';

  // The prop is the source of truth whenever the loader revalidates (another tab or the list page may have changed it).
  useEffect(() => { setSharedAt(session.sharedAt); }, [session.sharedAt]);

  useEffect(() => {
    if (!on) return;
    let live = true;
    gateway.getShareLink().then(l => { if (live) { setToken(l.token); setSharedCount(l.sharedCount); } }).catch(() => {});
    return () => { live = false; };
  }, [gateway, on]);

  async function apply(shared: boolean) {
    setBusy(true);
    setError('');
    try { setSharedAt(await gateway.setShared(session.id, shared)); setAsking(false); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Không đổi được việc chia sẻ'); }
    finally { setBusy(false); }
  }
  const toggle = () => { if (!ended || busy) return; if (on) void apply(false); else { setUnderstood(false); setAsking(true); } };

  return (
    <Card style={{ borderColor: on ? 'var(--brand-200)' : undefined }}>
      <section aria-labelledby="share-h" style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <h2 id="share-h" style={{ margin: 0, font: '700 16px/1.35 var(--font-sans)', color: 'var(--text-title)' }}>Chia sẻ phiên này</h2>
            <p style={{ margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Người có link chia sẻ xem được đề, đáp án, lời giải và tỉ lệ chọn của lớp.</p>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true" style={{ font: '600 13px/1 var(--font-sans)', color: on ? 'var(--brand-700)' : 'var(--ink-600)' }}>{on ? 'Bật' : 'Tắt'}</span>
            <button type="button" role="switch" aria-checked={on} aria-labelledby="share-h" aria-disabled={!ended || busy} aria-describedby="share-state" onClick={toggle}
              style={{ position: 'relative', flex: 'none', width: 48, height: 28, padding: 0, border: 0, borderRadius: 99, background: on ? 'var(--brand-600)' : ended ? 'var(--ink-400)' : 'var(--ink-200)', cursor: ended ? 'pointer' : 'not-allowed' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: ended ? '#fff' : 'var(--ink-050)', boxShadow: '0 1px 2px rgba(20,23,28,.3)', display: 'grid', placeItems: 'center', transition: 'left var(--dur-fast) var(--ease-standard)' }}>
                {!ended && <Icon name="lock" size={12} style={{ color: 'var(--ink-500)' }} />}
              </span>
            </button>
          </span>
        </div>

        <div id="share-state">
          {!ended ? (
            <p style={{ margin: 0, display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', font: 'var(--type-ui)', fontSize: 14, color: 'var(--ink-700)' }}>
              <Icon name="lock" size={16} style={{ marginTop: 2 }} /><span><b>Chỉ chia sẻ được sau khi đóng phiên.</b> Phiên chưa kết thúc.</span>
            </p>
          ) : (
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
              <Pill on={on} />{on ? <>từ <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-body)' }}>{formatDate(sharedAt!)}</span></> : 'Chỉ bạn thấy trang này.'}
            </p>
          )}
        </div>

        {error && <ErrorMessage message={error} />}

        {on && (
          <div style={{ display: 'grid', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border-hairline)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span aria-live="polite"><Button size="sm" variant="secondary" icon={copied ? 'check' : 'copy'} disabled={!link} onClick={() => copy(link)}>{copied ? 'Đã sao chép' : 'Sao chép link chia sẻ'}</Button></span>
              <Button size="sm" variant="ghost" icon="eye" disabled={!link} onClick={() => window.open(link, '_blank')}>Xem như người xem</Button>
            </div>
            {link && <code style={{ font: 'var(--type-code)', fontSize: 13, background: 'var(--paper)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', wordBreak: 'break-all', userSelect: 'all' }}>{link}</code>}
            <p style={{ margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Một link chung cho mọi phiên đang chia sẻ{sharedCount !== null ? ` (${sharedCount} phiên)` : ''}. Đổi link ở trang Phiên thi.</p>
          </div>
        )}

        <p style={{ margin: 0, display: 'flex', gap: 8, font: 'var(--type-meta)', color: 'var(--text-faint)' }}><Icon name="shield-alert" size={14} style={{ marginTop: 2 }} /><span>Không bao giờ hiện tên, điểm, bài làm hay tên phiên này.</span></p>
      </section>

      <ConfirmDialog open={asking} width={560} busy={busy}
        title={warn.unfinished > 0 ? 'Chia sẻ khi đề còn phiên đang mở?' : 'Chia sẻ phiên này?'}
        confirmLabel={warn.unfinished > 0 ? 'Vẫn chia sẻ' : 'Chia sẻ'} tone={warn.unfinished > 0 ? 'danger' : 'primary'}
        confirmDisabled={warn.unfinished > 0 && !understood} disabledReason="Đánh dấu ô xác nhận ở trên để chia sẻ."
        onConfirm={() => void apply(true)} onCancel={() => setAsking(false)}>
        <div style={{ display: 'grid', gap: 14, textAlign: 'left' }}>
          {warn.unfinished > 0 && <ErrorMessage tone="warning" title={`Đề này còn ${warn.unfinished} phiên chưa kết thúc`} message="Học viên ở các phiên đó có thể mở link và thấy đáp án trong lúc đang làm bài. Nên đợi các phiên đó đóng rồi hãy chia sẻ." />}
          {warn.fewSubmissions !== null && <ErrorMessage tone="warning" title={`Phiên chỉ có ${warn.fewSubmissions} bài nộp`} message="Người xem có thể suy ra từng người đã chọn gì từ tỉ lệ chọn." />}
          <p style={{ margin: 0 }}>Ai có link chia sẻ sẽ xem được đáp án và lời giải của đề <b style={{ color: 'var(--text-title)' }}>{session.exam.title}</b>. Người sắp thi đề này không nên được xem.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {([['Trang chia sẻ có', HAS, 'check', 'var(--correct-600)'], ['Không bao giờ có', HAS_NOT, 'x', 'var(--ink-500)']] as const).map(([t, items, icon, color]) => (
              <div key={t} style={{ display: 'grid', gap: 8, alignContent: 'start', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
                <h3 style={listTitle}>{t}</h3>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6, font: 'var(--type-ui)', fontSize: 13, lineHeight: 1.4 }}>
                  {items.map(x => <li key={x} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0,1fr)', gap: 6 }}><Icon name={icon} size={14} style={{ color, marginTop: 1 }} />{x}</li>)}
                </ul>
              </div>
            ))}
          </div>
          {warn.unfinished > 0 && (
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--warn-border)', font: 'var(--type-ui)', fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} style={{ width: 18, height: 18, margin: '1px 0 0' }} />
              <span>Tôi hiểu học viên của {warn.unfinished} phiên đang mở có thể thấy đáp án, vẫn chia sẻ ngay.</span>
            </label>
          )}
        </div>
      </ConfirmDialog>
    </Card>
  );
}
