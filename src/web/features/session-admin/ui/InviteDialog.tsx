import { useEffect, useMemo, useState } from 'react';
import type { SessionSummary } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { SessionSlot } from '../../../shared/ui/SessionSlot.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { useJoinHost } from '../../../shared/room/join-url.js';
import { useSessionAdminGateway } from '../application/session-admin-context.js';
import { buildInvitation, duplicateTitles } from '../domain/invitation.js';

/**
 * "Gửi lời mời" (PRODUCT.md §7.26): the mentor ticks open sessions and gets one message to paste into the class chat.
 * The text is editable; changing the selection regenerates it.
 */
export function InviteDialog({ sessions, onClose }: { sessions: SessionSummary[]; onClose: () => void }) {
  const gateway = useSessionAdminGateway();
  const { host, unreachable } = useJoinHost(() => gateway.getJoinHosts());
  const [picked, setPicked] = useState<Set<number>>(() => new Set(sessions.map(s => s.id)));
  const chosen = useMemo(() => sessions.filter(s => picked.has(s.id)), [sessions, picked]);
  const generated = useMemo(() => buildInvitation(chosen, host), [chosen, host]);
  const [text, setText] = useState(generated);
  const [copied, setCopied] = useState(false);
  useEffect(() => setText(generated), [generated]);
  const dupes = duplicateTitles(chosen);

  function toggle(id: number) {
    setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* not available over plain http: the text is selectable */ }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Gửi lời mời" style={{ width: '100%', maxWidth: 600, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--paper)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-dialog)', padding: 24, display: 'grid', gap: 14 }}>
        <h3 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)' }}>Gửi lời mời</h3>
        <p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-body)' }}>Chọn các phiên rồi sao chép đoạn tin, dán vào nhóm chat của lớp. Tin chỉ có tên đề, không có tên phiên hay tên nhóm.</p>
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          <legend style={{ font: 'var(--type-label)', color: 'var(--text-meta)', marginBottom: 6 }}>Phiên đang mở</legend>
          {sessions.map(s => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', font: 'var(--type-body)' }}>
              <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
              <SessionSlot n={s.slot} size={22} />
              <span style={{ fontWeight: 600, color: 'var(--text-title)' }}>{s.name}</span>
              <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>· {s.examTitle}</span>
            </label>
          ))}
        </fieldset>
        {dupes.length > 0 && (
          <ErrorMessage tone="warning" message={<>Nhiều phiên cùng đề <b>{dupes.join(', ')}</b>: member nhìn tin sẽ không phân biệt được và dễ vào nhầm phòng. Nên gửi riêng cho từng nhóm, hoặc ghi chú thêm vào tin.</>} />
        )}
        {unreachable && (
          <ErrorMessage tone="warning" message={<>Không tìm thấy địa chỉ mạng LAN của máy này. Link trong tin sẽ không mở được từ máy member.</>} />
        )}
        <TextField label="Nội dung tin (sửa được)" multiline rows={10} value={text} onChange={setText} spellCheck={false} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button icon={copied ? 'check' : 'copy'} disabled={!text.trim()} onClick={copy}>{copied ? 'Đã sao chép' : 'Sao chép tin'}</Button>
        </div>
      </div>
    </div>
  );
}
