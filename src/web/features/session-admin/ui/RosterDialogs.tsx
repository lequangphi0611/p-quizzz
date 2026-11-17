import { useMemo, useState } from 'react';
import { parseEmailList } from '../../../../shared/email-list.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { EmailListPreview } from '../../../shared/ui/EmailListPreview.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { saveNote } from '../../../shared/ui/email-preview-rows.js';

/** "Thêm email cho phiên này": an exception for one session. The saved group it came from is not changed. */
export function AddEmailsDialog({ open, busy, onCancel, onSubmit }: { open: boolean; busy: boolean; onCancel: () => void; onSubmit: (emails: string[]) => void }) {
  const [text, setText] = useState('');
  const [domain, setDomain] = useState('');
  const parse = useMemo(() => parseEmailList(text, domain), [text, domain]);
  return (
    <ConfirmDialog open={open} width={560} title="Thêm email cho phiên này" confirmLabel={parse.valid.length > 0 ? `Thêm ${parse.valid.length} email` : 'Thêm'} busy={busy}
      confirmDisabled={parse.valid.length === 0} disabledReason="Dán ít nhất một email hợp lệ" onCancel={onCancel} onConfirm={() => onSubmit(parse.valid.map(v => v.email))}>
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0 }}>Chỉ thêm vào phiên đang mở này. Nhóm đã lưu không bị sửa, và người đã vào không bị ảnh hưởng.</p>
        <TextField label="Email" multiline mono rows={4} value={text} onChange={setText} spellCheck={false} autoFocus placeholder="linh@company.vn" />
        <TextField label="Domain mặc định (tuỳ chọn)" value={domain} onChange={setDomain} placeholder="company.vn" spellCheck={false} />
        <EmailListPreview parse={parse} maxHeight={160} />
        {saveNote(parse) && <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{saveNote(parse).replace('Khi lưu', 'Khi thêm')}</span>}
      </div>
    </ConfirmDialog>
  );
}

/** "Lưu thành nhóm": keeps this session's typed list for later sessions. */
export function SaveGroupDialog({ open, busy, count, onCancel, onSubmit }: { open: boolean; busy: boolean; count: number; onCancel: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <ConfirmDialog open={open} title="Lưu thành nhóm" confirmLabel="Lưu nhóm" busy={busy} confirmDisabled={!name.trim()} disabledReason="Nhập tên nhóm" onCancel={onCancel} onConfirm={() => onSubmit(name.trim())}>
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0 }}>Danh sách {count} email của phiên này sẽ thành một nhóm để dùng cho các phiên sau.</p>
        <TextField label="Tên nhóm" value={name} onChange={setName} placeholder="vd. #docker-1511" maxLength={60} autoFocus />
      </div>
    </ConfirmDialog>
  );
}
