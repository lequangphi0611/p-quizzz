import { useState, type ReactNode } from 'react';
import type { MeResponse } from '../../../../shared/api/index.js';
import { MAX_EDIT_REASON_LENGTH } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { Chip, mText, useIsDesk } from '../../../shared/ui/member/member-shell.js';
import { useExamGateway } from '../application/exam-gateway-context.js';
import { errorText } from '../application/taking-controller.js';
import { checkReason, EDIT_RULE, editPanelMode } from '../domain/edit-request.js';
import { formatClock } from '../../../shared/format/date.js';

const TONES = { ink: ['var(--ink-100)', 'var(--ink-700)'], warn: ['var(--warn-surface)', 'var(--warn-600)'], brand: ['var(--brand-100)', 'var(--brand-700)'], ok: ['var(--correct-surface)', 'var(--correct-600)'] } as const;

function CardHead({ icon, tone = 'ink', title, chip }: { icon: string; tone?: keyof typeof TONES; title: string; chip?: ReactNode }) {
  const [bg, fg] = TONES[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <span aria-hidden="true" style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: bg, color: fg }}><Icon name={icon} size={18} /></span>
      <h2 style={{ margin: 0, flex: 1, minWidth: 0, font: 'var(--type-ui)', fontSize: 17, fontWeight: 700, color: 'var(--text-title)' }}>{title}</h2>
      {chip}
    </div>
  );
}

const RuleLine = () => <p style={{ ...mText.meta, display: 'flex', gap: 8 }}><Icon name="lock" size={15} style={{ marginTop: 2, flex: 'none' }} /><span>{EDIT_RULE}</span></p>;

const Quote = ({ children }: { children: ReactNode }) => (
  <blockquote style={{ margin: 0, padding: '10px 12px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', font: 'var(--type-meta)', color: 'var(--text-body)', overflowWrap: 'anywhere', textWrap: 'pretty' }}>“{children}”</blockquote>
);

/**
 * Card under "Đã nộp bài" (PRODUCT.md §7.21, design S19): ask, wait, rejected, done. The approved state is not here:
 * it takes over the page (`EditingPage`).
 */
export function EditRequestPanel({ me, onChanged }: { me: MeResponse; onChanged: () => Promise<void> }) {
  const desk = useIsDesk();
  const gateway = useExamGateway();
  const mode = editPanelMode(me);
  const done = me.attempt.submitted[0];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!done || mode === 'none' || mode === 'editing') return null;

  const req = done.editRequest;
  const size = desk ? 'md' : 'lg';
  const send = async () => {
    const checked = checkReason(reason);
    if (!checked.ok) { setError(checked.error); return; }
    setBusy(true); setError('');
    try { await gateway.requestEdit(done.id, checked.reason); await onChanged(); }
    catch (err) { setError(errorText(err, 'Không gửi được yêu cầu. Thử lại.')); setBusy(false); }
  };

  let body: ReactNode;
  if (mode === 'waiting') {
    body = <>
      <CardHead icon="hourglass" tone="warn" title="Đang chờ mentor duyệt" chip={req ? <Chip icon="clock">Đã gửi {formatClock(req.requestedAt)}</Chip> : undefined} />
      {req && <Quote>{req.reason}</Quote>}
      <RuleLine />
      <p style={mText.meta}>Khi mentor duyệt, phần sửa bài sẽ hiện ở đầu trang.</p>
    </>;
  } else if (mode === 'done') {
    body = <>
      <CardHead icon="circle-check" tone="ok" title="Đã sửa bài tự luận" />
      <p style={mText.meta}>{req?.resolvedAt ? `Hoàn tất lúc ${formatClock(req.resolvedAt)}. ` : ''}Bản sửa đã gửi mentor chấm. Mỗi bài chỉ mở lại một lần nên phần này đã đóng.</p>
    </>;
  } else if (mode === 'retry' && !open) {
    body = <>
      <CardHead icon="x" tone="warn" title="Mentor chưa đồng ý mở lại" />
      <p style={mText.meta}>Bạn có thể gửi lại kèm lý do cụ thể hơn, ví dụ câu nào, thiếu ý gì.</p>
      {req && <Quote>{req.reason}</Quote>}
      <div><Button variant="secondary" size={size} icon="rotate-ccw" block={!desk} onClick={() => setOpen(true)}>Gửi lại yêu cầu</Button></div>
    </>;
  } else if (!open) {
    body = <>
      <CardHead icon="pencil" title="Cần bổ sung bài tự luận?" />
      <RuleLine />
      <div><Button variant="secondary" size={size} icon="pencil" block={!desk} onClick={() => setOpen(true)}>Xin sửa bài tự luận</Button></div>
    </>;
  } else {
    body = <>
      <CardHead icon="pencil" title={mode === 'retry' ? 'Gửi lại yêu cầu sửa bài' : 'Xin sửa bài tự luận'} />
      <RuleLine />
      <div style={{ display: 'grid', gap: 6 }}>
        <TextField label="Lý do" multiline rows={3} value={reason} onChange={setReason} maxLength={MAX_EDIT_REASON_LENGTH} placeholder="Ví dụ: em quên ý cuối của câu 4." error={error || undefined} autoFocus />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, ...mText.meta, fontSize: 13 }}><span>Mentor đọc lý do để quyết định.</span><span style={{ ...mText.mono, flex: 'none' }}>{reason.length}/{MAX_EDIT_REASON_LENGTH}</span></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexDirection: desk ? 'row' : 'column' }}>
        <Button size={size} icon="send" block={!desk} loading={busy} disabled={busy} onClick={() => void send()}>Gửi yêu cầu</Button>
        <Button size={size} variant="ghost" block={!desk} disabled={busy} onClick={() => { setOpen(false); setError(''); }}>Huỷ</Button>
      </div>
    </>;
  }

  return <Card padding={desk ? 24 : 20}><div style={{ display: 'grid', gap: 14 }}>{body}</div></Card>;
}
