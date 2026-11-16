import { useState, type ReactNode } from 'react';
import type { MeResponse } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Kbd } from '../../../shared/ui/Kbd.js';
import { formatPoints } from '../../../shared/format/points.js';
import { MemberPage, PageCard, mText, useIsDesk, useShowKeys } from '../../../shared/ui/member/member-shell.js';
import { errorText } from '../application/taking-controller.js';

export function StartScreen({ me, onStart }: { me: MeResponse; onStart: () => Promise<void> }) {
  const desk = useIsDesk();
  const showKeys = useShowKeys();
  const { session } = me;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    if (busy) return;
    setBusy(true); setError('');
    try { await onStart(); } catch (err) { setError(errorText(err, 'Không bắt đầu được')); setBusy(false); }
  }
  const btn = <Button size="lg" block icon="play" loading={busy} onClick={() => void start()}>Bắt đầu làm bài</Button>;
  const stat = (n: ReactNode, l: string) => <div style={{ display: 'grid', gap: 4, padding: '14px 12px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}><span style={{ font: '700 24px/1 var(--font-mono)', color: 'var(--text-title)' }}>{n}</span><span style={mText.meta}>{l}</span></div>;
  const rule = (icon: string, text: ReactNode) => <li key={icon} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Icon name={icon} size={16} style={{ marginTop: 3, color: 'var(--text-meta)' }} /><span>{text}</span></li>;
  return (
    <MemberPage desk={desk} title={session.title} name={me.participant.displayName} maxW={520} footer={desk ? undefined : btn}>
      <PageCard desk={desk}>
        <div style={{ display: 'grid', gap: 6 }}><span style={{ ...mText.label, color: 'var(--correct-600)' }}>Phiên đã bắt đầu</span><h1 style={mText.h1}>{session.title}</h1></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>{stat(session.questionCount, 'câu')}{stat(formatPoints(session.totalPoints), 'điểm')}{stat(1, 'lượt làm')}</div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10, font: 'var(--type-ui)', fontSize: 15, color: 'var(--text-body)' }}>
          {rule('lock', 'Mỗi người làm 1 lần — nộp rồi không làm lại, không sửa được.')}
          {rule('save', 'Bài được lưu liên tục. Tải lại trang hay rớt mạng cũng không mất bài.')}
          {session.hasEssay && rule('pencil', 'Có câu tự luận — mentor chấm sau khi đóng phiên.')}
          {rule('eye-off', 'Đáp án và điểm từng câu chỉ hiện sau khi mentor đóng phiên.')}
        </ul>
        {showKeys && (
          <p style={{ ...mText.meta, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '10px 12px', border: '1px dashed var(--ink-300)', borderRadius: 'var(--radius-md)' }}>
            Mẹo: <Kbd>←</Kbd><Kbd>→</Kbd> chuyển câu, <Kbd>1</Kbd>–<Kbd>9</Kbd> chọn phương án, <Kbd>?</Kbd> xem tất cả phím tắt.
          </p>
        )}
        {error && <ErrorMessage message={error} />}
        {desk && btn}
      </PageCard>
    </MemberPage>
  );
}
