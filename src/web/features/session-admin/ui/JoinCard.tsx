import { useState } from 'react';
import type { SessionDetail } from '../../../../shared/api/index.js';
import { Button } from '../../../components/ui/Button.js';
import { Card } from '../../../components/ui/Card.js';
import { ErrorMessage } from '../../../components/ui/ErrorMessage.js';
import { useJoinHost } from '../../../lib/join-url.js';
import { formatRoomCode, joinLink } from '../../../lib/room-code.js';

const caption = { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--brand-700)' } as const;

// What the mentor hands out: the address, the room code, and a link that has the code built in.
export function JoinCard({ status, roomCode }: { status: SessionDetail['status']; roomCode: string | null }) {
  const { host, unreachable } = useJoinHost();
  const [copied, setCopied] = useState(false);
  const open = status === 'lobby' || status === 'running';
  const link = roomCode ? joinLink(host, roomCode) : '';

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* not available over plain http: the link is selectable */ }
  }
  const mono = (live: boolean) => ({ font: '700 26px/1.1 var(--font-mono)', color: live ? 'var(--text-title)' : 'var(--text-faint)', wordBreak: 'break-all' }) as const;

  return (
    <Card tone="brand">
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={caption}>Địa chỉ cho member</span>
        <span style={mono(open)}>{host}</span>
        <span style={{ ...caption, marginTop: 6 }}>Mã phòng</span>
        {roomCode ? (
          <span style={{ ...mono(open), fontSize: 34, letterSpacing: '0.12em' }}>{formatRoomCode(roomCode)}</span>
        ) : (
          <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Mã phòng sẽ có khi bạn mở phòng chờ.</span>
        )}
        {roomCode && open && (
          <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Hoặc gửi link — member bấm vào là vào luôn, khỏi gõ mã:</span>
            <code style={{ font: 'var(--type-code)', fontSize: 13, background: 'var(--paper)', border: '1px solid var(--brand-200)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', wordBreak: 'break-all', userSelect: 'all' }}>{link}</code>
            <div><Button size="sm" variant="secondary" icon={copied ? 'check' : 'copy'} onClick={copy}>{copied ? 'Đã sao chép' : 'Sao chép link'}</Button></div>
          </div>
        )}
        {roomCode && !open && <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Mã này đã hết hiệu lực vì phiên đã đóng.</span>}
        {unreachable && (
          <ErrorMessage tone="warning" message={<>Không tìm thấy địa chỉ mạng LAN của máy này. Kiểm tra máy đã kết nối Wi-Fi/mạng chưa — member không vào được bằng <b>localhost</b>.</>} />
        )}
      </div>
    </Card>
  );
}
