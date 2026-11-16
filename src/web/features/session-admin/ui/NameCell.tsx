import { useState } from 'react';
import type { SessionParticipantInfo } from '../../../../shared/api/index.js';
import { Button } from '../../../components/ui/Button.js';
import { Icon } from '../../../components/ui/Icon.js';

export function NameCell({ p, disabled, readOnly, onSave }: { p: SessionParticipantInfo; disabled: boolean; readOnly: boolean; onSave: (name: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(p.displayName);
  if (!editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--text-title)' }}>
        {p.displayName}
        {!readOnly && <button type="button" aria-label={`Đổi tên ${p.displayName}`} disabled={disabled} onClick={() => { setValue(p.displayName); setEditing(true); }} style={{ background: 'none', border: 0, padding: 2, cursor: disabled ? 'not-allowed' : 'pointer', color: 'var(--text-faint)' }}>
          <Icon name="pencil" size={14} />
        </button>}
      </span>
    );
  }
  const save = async () => { if (await onSave(value)) setEditing(false); };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        autoFocus value={value} maxLength={60} aria-label="Tên mới"
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ height: 32, width: 180, padding: '0 10px', font: 'var(--type-ui)', border: '1.5px solid var(--border-focus)', borderRadius: 'var(--radius-sm)' }}
      />
      <Button size="sm" onClick={save} disabled={disabled || !value.trim()}>Lưu</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Huỷ</Button>
    </span>
  );
}
