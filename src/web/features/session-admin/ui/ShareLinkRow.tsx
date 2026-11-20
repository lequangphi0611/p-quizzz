import { useEffect, useState } from 'react';
import type { ShareLinkInfo } from '../../../../shared/api/index.js';
import { ApiError } from '../../../shared/api-client/http-client.js';
import { useJoinHost } from '../../../shared/room/join-url.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { useSessionAdminGateway } from '../application/session-admin-context.js';
import { shareLink } from '../domain/share-ui.js';
import { useCopy } from './useCopy.js';

// The one share link above the session history (PRODUCT.md §7.33b, design C11): copy it, or replace it.
export function ShareLinkRow() {
  const gateway = useSessionAdminGateway();
  const { host } = useJoinHost(() => gateway.getJoinHosts());
  const [info, setInfo] = useState<ShareLinkInfo | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { copied, copy } = useCopy();

  useEffect(() => {
    let live = true;
    gateway.getShareLink().then(l => { if (live) setInfo(l); }).catch(() => {});
    return () => { live = false; };
  }, [gateway]);
  if (!info) return null;
  const link = shareLink(host, info.token);

  async function rotate() {
    setBusy(true);
    setError('');
    try { setInfo(await gateway.rotateShareLink()); setAsking(false); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Không đổi được link. Link cũ vẫn dùng được.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--paper)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--type-ui)', fontWeight: 600, color: 'var(--text-title)' }}><Icon name="eye" size={16} />Link chia sẻ</span>
      <code style={{ flex: '1 1 260px', minWidth: 0, font: 'var(--type-code)', fontSize: 13, color: 'var(--text-body)', wordBreak: 'break-all', userSelect: 'all' }}>{link}</code>
      <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{info.sharedCount > 0 ? `${info.sharedCount} phiên đang chia sẻ · ai có link đều xem được` : 'Chưa chia sẻ phiên nào'}</span>
      <span aria-live="polite"><Button size="sm" variant="secondary" icon={copied ? 'check' : 'copy'} onClick={() => copy(link)}>{copied ? 'Đã sao chép' : 'Sao chép'}</Button></span>
      <Button size="sm" variant="ghost" icon="refresh-cw" onClick={() => { setError(''); setAsking(true); }}>Đổi link</Button>
      <ConfirmDialog open={asking} busy={busy} title="Đổi link chia sẻ?" confirmLabel="Đổi link" tone="danger" onConfirm={() => void rotate()} onCancel={() => setAsking(false)}>
        <div style={{ display: 'grid', gap: 8 }}>
          {error && <ErrorMessage message={error} />}
          <p style={{ margin: 0 }}>Mọi người đang có link cũ sẽ không mở được nữa; bạn cần gửi lại link mới.</p>
          <p style={{ margin: 0, color: 'var(--text-meta)', fontSize: 14 }}>{info.sharedCount > 0 ? `${info.sharedCount} phiên vẫn đang được chia sẻ — chỉ link thay đổi.` : 'Các phiên đang chia sẻ giữ nguyên, chỉ link thay đổi.'} Ai mở link cũ sẽ thấy “Link này không mở được”.</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
