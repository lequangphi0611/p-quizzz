import { useState } from 'react';
import { useJoinHost } from '../../../shared/room/join-url.js';
import { formatRoomCode, joinLink } from '../../../shared/room/room-code.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { useTrainingAdminGateway } from '../application/training-admin-context.js';

const caption = { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--brand-700)' } as const;

/** Copies text; `copied` stays true for 2 seconds. Without clipboard access (plain http) the text stays selectable. */
function useCopy(): { copied: boolean; copy: (text: string) => Promise<void> } {
  const [copied, setCopied] = useState(false);
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* select the text by hand */ }
  }
  return { copied, copy };
}

/**
 * A training that nobody has joined yet: the room code in very large type (this page is often on the projector), the address
 * and a link with the code built in, and a few lines the mentor can read to the class.
 */
export function RoomCodeCard({ roomCode }: { roomCode: string }) {
  const gateway = useTrainingAdminGateway();
  const { host, unreachable } = useJoinHost(() => gateway.getJoinHosts());
  const { copied, copy } = useCopy();
  const link = joinLink(host, roomCode);
  const shown = formatRoomCode(roomCode);

  return (
    <Card tone="brand" padding={32}>
      <div style={{ display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
          <span style={caption}>Mã phòng</span>
          <span aria-label={`Mã phòng ${roomCode.split('').join(' ')}`} style={{ font: '800 clamp(48px, 6.4vw, 88px)/1 var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-title)', whiteSpace: 'nowrap' }}>{shown}</span>
          <span style={{ ...caption, marginTop: 8 }}>Địa chỉ cho học viên</span>
          <span style={{ font: '700 26px/1.2 var(--font-mono)', color: 'var(--text-title)', wordBreak: 'break-all' }}>{host}</span>
          <div style={{ display: 'grid', gap: 6, marginTop: 4, justifyItems: 'start' }}>
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Hoặc gửi link, bấm vào là điền sẵn mã:</span>
            <code style={{ font: 'var(--type-code)', fontSize: 13, background: 'var(--paper)', border: '1px solid var(--brand-200)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', wordBreak: 'break-all', userSelect: 'all' }}>{link}</code>
            <Button size="sm" variant="secondary" icon={copied ? 'check' : 'copy'} onClick={() => void copy(link)}>{copied ? 'Đã sao chép' : 'Sao chép link'}</Button>
          </div>
          {unreachable && <ErrorMessage tone="warning" message={<>Không tìm thấy địa chỉ mạng LAN của máy này. Kiểm tra máy đã kết nối Wi-Fi/mạng chưa: học viên không vào được bằng <b>localhost</b>.</>} />}
        </div>

        <div style={{ display: 'grid', gap: 12, background: 'var(--paper)', border: '1px solid var(--brand-200)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <h2 style={{ margin: 0, font: 'var(--type-h2)', fontSize: 17, color: 'var(--text-title)' }}>Đọc cho lớp</h2>
          <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8, font: 'var(--type-body)', color: 'var(--text-body)' }}>
            <li>Mở trình duyệt, vào địa chỉ <b>{host}</b>.</li>
            <li>Gõ mã phòng <b>{shown}</b> ở trang đầu.</li>
            <li>Đọc phần “những gì được gửi về máy mentor”, nhập tên rồi chọn đồng ý (hoặc không tham gia, vẫn học bình thường).</li>
            <li>Làm theo hướng dẫn để thêm cấu hình vào <b>thư mục bài tập</b>.</li>
          </ol>
          <p style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
            <Icon name="hourglass" size={16} />Chưa có học viên nào. Mỗi người sẽ hiện ở đây ngay khi họ đồng ý tham gia.
          </p>
        </div>
      </div>
    </Card>
  );
}

/** The code on a page that already has members: small, so a late joiner can still be told, and the link can be copied. */
export function RoomCodeInline({ roomCode }: { roomCode: string }) {
  const gateway = useTrainingAdminGateway();
  const { host } = useJoinHost(() => gateway.getJoinHosts());
  const { copied, copy } = useCopy();
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ ...caption }}>Mã phòng</span>
      <span style={{ font: '800 22px/1 var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-title)' }}>{formatRoomCode(roomCode)}</span>
      <Button size="sm" variant="ghost" icon={copied ? 'check' : 'copy'} onClick={() => void copy(joinLink(host, roomCode))}>{copied ? 'Đã sao chép' : 'Sao chép link'}</Button>
    </div>
  );
}
