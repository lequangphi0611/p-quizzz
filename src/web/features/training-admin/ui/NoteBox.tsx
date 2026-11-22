import { useState } from 'react';
import { MENTOR_NOTE_MAX, type TrainingMemberRow } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';

/**
 * The mentor's note for one member, written under the timeline header and kept for the report. Only the mentor sees it:
 * the member never does. A draft stays until it is saved or the member changes (the parent keys this by member).
 */
export function NoteBox({ member, onSave }: { member: TrainingMemberRow; onSave: (note: string) => Promise<string | null> }) {
  const saved = member.mentorNote ?? '';
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const dirty = draft.trim() !== saved;
  const id = `note-${member.id}`;

  const save = async () => {
    setSaving(true);
    setError('');
    const failure = await onSave(draft);
    setSaving(false);
    if (failure) setError(failure);
    else setJustSaved(true);
  };

  return (
    <div style={{ display: 'grid', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)', background: 'var(--surface-sunken)' }}>
      <label htmlFor={id} style={{ font: 'var(--type-label)', color: 'var(--text-title)' }}>Ghi chú về {member.displayName}</label>
      <textarea id={id} value={draft} rows={3} maxLength={MENTOR_NOTE_MAX} placeholder="Điều cần nhắc bạn ấy, hoặc điều đáng kể cho lớp…"
        onChange={e => { setDraft(e.target.value); setJustSaved(false); }}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ink-400)', font: 'var(--type-body)', fontSize: 14, color: 'var(--text-body)', background: 'var(--paper)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button size="sm" variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>Lưu ghi chú</Button>
        <span role="status" style={{ font: 'var(--type-meta)', fontSize: 13, color: error ? 'var(--wrong-600)' : 'var(--text-meta)' }}>
          {error || (justSaved && !dirty ? 'Đã lưu.' : dirty ? 'Chưa lưu.' : 'Chỉ vào báo cáo. Bạn ấy không thấy ghi chú này.')}
        </span>
        <span style={{ marginLeft: 'auto', font: 'var(--type-meta)', fontSize: 12.5, color: 'var(--text-meta)', fontVariantNumeric: 'tabular-nums' }}>{[...draft].length}/{MENTOR_NOTE_MAX}</span>
      </div>
    </div>
  );
}
