import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { ExamSummary } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { useCreateSession } from '../application/session-admin-context.js';
import { suggestSessionName } from '../domain/session-ui.js';

const selectStyle = { width: '100%', height: 44, padding: '0 12px', font: 'var(--type-body)', fontSize: 16, color: 'var(--text-title)', background: 'var(--paper)', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)' } as const;

export function CreateSessionForm({ exams, initialExamId, onCancel }: { exams: ExamSummary[]; initialExamId: number | null; onCancel: () => void }) {
  const nav = useNavigate();
  const [examId, setExamId] = useState<number | ''>(exams.some(e => e.id === initialExamId) ? initialExamId! : '');
  const [name, setName] = useState('');
  const [shuffle, setShuffle] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const { create: createSession, busy, error } = useCreateSession();

  async function create() {
    if (examId === '') return;
    const s = await createSession({ examId, name: name.trim() || undefined, shuffle, autoApprove });
    if (s) nav(`/admin/sessions/${s.id}`);
  }

  return (
    <Card title="Tạo phiên thi" tone="brand">
      <div style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Đề thi</span>
          <select value={examId} onChange={e => setExamId(e.target.value ? Number(e.target.value) : '')} style={selectStyle}>
            <option value="">Chọn đề…</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.title} · {e.questionCount} câu</option>)}
          </select>
        </label>
        <TextField label="Tên phiên" value={name} onChange={setName} maxLength={80}
          placeholder={examId === '' ? 'vd. Ôn tập Git – lớp sáng' : suggestSessionName(exams.find(e => e.id === examId)?.title ?? '', new Date())}
          hint="Chỉ mentor thấy, để phân biệt khi mở nhiều phiên cùng lúc. Học viên và màn chiếu chỉ thấy tên đề." />
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: 'var(--type-ui)', color: 'var(--text-title)', cursor: 'pointer' }}>
          <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand-600)' }} />
          Trộn thứ tự câu hỏi và đáp án cho từng người
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, font: 'var(--type-ui)', color: 'var(--text-title)', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--brand-600)' }} />
          <span>Tự động duyệt người vào<br /><span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Tắt: bạn duyệt từng tên (tránh một người vào bằng nhiều tên). Bật khi cả nhóm là người quen.</span></span>
        </label>
        {error && <ErrorMessage message={error} />}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon="plus" loading={busy} disabled={examId === ''} onClick={create}>Tạo phiên</Button>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>Huỷ</Button>
        </div>
      </div>
    </Card>
  );
}
