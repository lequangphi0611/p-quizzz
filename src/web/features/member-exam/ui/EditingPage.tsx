import { useEffect, useRef, type ReactNode } from 'react';
import type { MeResponse } from '../../../../shared/api/index.js';
import { useKeyboardOpen } from '../../../shared/hooks/useKeyboardOpen.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { SaveIndicator } from '../../../shared/ui/SaveIndicator.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { useOnline } from '../../../shared/hooks/useOnline.js';
import { formatPoints } from '../../../shared/format/points.js';
import { Chip, MemberPage, mText, useIsDesk } from '../../../shared/ui/member/member-shell.js';
import { useEssayEdit } from '../application/use-essay-edit.js';
import { formatClock } from '../../../shared/format/date.js';

/** One line instead of the full "Đã nộp bài" card, so the essays come first. */
function ScoreMini({ me }: { me: MeResponse }) {
  const done = me.attempt.submitted[0]!;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', flexWrap: 'wrap', ...mText.meta }}>
      <Icon name="circle-check" size={16} color="var(--brand-600)" />
      <span style={{ color: 'var(--text-title)', fontWeight: 600 }}>Đã nộp lúc {formatClock(done.submittedAt)}</span><span>·</span>
      <span>Trắc nghiệm <b style={mText.mono}>{formatPoints(done.score)}/{formatPoints(done.maxScore)}</b></span>
      <span style={{ marginLeft: 'auto' }}><Chip icon="hourglass">Tạm tính</Chip></span>
    </div>
  );
}

/**
 * Approved edit request (PRODUCT.md §7.21, design S19): the essay editor takes over the top of the page, the score card
 * shrinks to a line, and "Hoàn tất sửa bài" (with a confirmation) sits in a footer that sticks to the bottom.
 */
export function EditingPage({ me, onChanged, leaderboard }: { me: MeResponse; onChanged: () => Promise<void>; leaderboard?: ReactNode }) {
  const desk = useIsDesk();
  const online = useOnline();
  const keyboardOpen = useKeyboardOpen();
  const done = me.attempt.submitted[0]!;
  const edit = useEssayEdit(done.id, onChanged);
  const headRef = useRef<HTMLHeadingElement>(null);
  const loaded = edit.view !== null;

  // Arriving here (the mentor just approved): back to the top, focus the heading so screen readers announce it.
  useEffect(() => { if (loaded) { window.scrollTo(0, 0); headRef.current?.focus({ preventScroll: true }); } }, [loaded]);

  const { view } = edit;
  const essays = view?.questions.filter(q => q.type === 'essay') ?? [];
  const saveState = online ? edit.save : 'offline';
  const blocked = edit.save === 'error' || !online;
  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...(desk ? { position: 'sticky', bottom: 0, padding: '12px 0', background: 'linear-gradient(transparent, var(--surface-page) 30%)' } : {}) }}>
      <span style={{ flex: desk ? 'none' : 1, minWidth: 0 }}><SaveIndicator state={saveState} onRetry={edit.retrySave} /></span>
      {desk && <span style={{ flex: 1 }} />}
      <Button size="lg" icon="check" disabled={!loaded || edit.finishing} onClick={edit.requestFinish} style={desk ? undefined : { flex: 'none' }}>Hoàn tất sửa bài</Button>
    </div>
  );

  const editor = !view ? (
    edit.error ? <ErrorMessage message={edit.error} /> : <Spinner block label="Đang mở bài…" />
  ) : (
    <div style={{ background: 'var(--paper)', border: '2px solid var(--brand-500)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-raised)' }}>
      <div style={{ display: 'grid', gap: 6, padding: desk ? '16px 24px' : '14px 16px', background: 'var(--brand-050)', borderBottom: '1px solid var(--brand-200)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="pencil" size={18} color="var(--brand-700)" />
          <h2 ref={headRef} tabIndex={-1} data-pq-focus="" style={{ margin: 0, flex: 1, outline: 'none', boxShadow: 'none', font: 'var(--type-ui)', fontSize: 17, fontWeight: 700, color: 'var(--brand-800)' }}>Mentor đã mở lại phần tự luận</h2>
        </div>
        <p role="status" style={{ ...mText.meta, color: 'var(--brand-800)' }}>
          Sửa <b>{essays.length} câu tự luận</b> bên dưới. {view.questions.length - essays.length} câu trắc nghiệm giữ nguyên. Bài tự lưu: bấm <b>Hoàn tất sửa bài</b> khi xong; chỉ làm được một lần.
        </p>
      </div>
      <div style={{ display: 'grid', gap: 24, padding: desk ? 24 : 16 }}>
        {essays.map(q => (
          <section key={q.id} style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={mText.label}>Câu {view.questions.indexOf(q) + 1}/{view.questions.length}</span><Chip tone="ink" icon="pencil">Tự luận · {formatPoints(q.points)} điểm</Chip></div>
            <div style={{ font: 'var(--type-body)', color: 'var(--text-title)', overflowWrap: 'anywhere' }}><Markdown inlineOnly source={q.prompt} /></div>
            {q.body && <Markdown source={q.body} />}
            <TextField multiline mono rows={desk ? 8 : 6} spellCheck={false} value={edit.texts[q.id] ?? ''} onChange={text => edit.setText(q.id, text)} />
          </section>
        ))}
        {edit.error && <ErrorMessage message={edit.error} />}
      </div>
    </div>
  );

  return (
    <>
      <MemberPage desk={desk} title={me.session.title} name={me.participant.displayName} maxW={760} footer={desk || keyboardOpen ? undefined : footer}>
        {editor}
        {desk && view && footer}
        <ScoreMini me={me} />
        {leaderboard}
      </MemberPage>
      <ConfirmDialog open={edit.confirming} title="Hoàn tất sửa bài?" confirmLabel="Hoàn tất" cancelLabel="Sửa tiếp" busy={edit.finishing} confirmDisabled={blocked}
        disabledReason={blocked ? 'Còn thay đổi chưa lưu được. Kiểm tra mạng rồi thử lại.' : undefined} onCancel={edit.cancelFinish} onConfirm={() => void edit.finish()}>
        Sau khi hoàn tất, phần tự luận đóng lại và <b>không mở lại được nữa</b>. Mọi thay đổi đã được lưu tự động.
      </ConfirmDialog>
    </>
  );
}
