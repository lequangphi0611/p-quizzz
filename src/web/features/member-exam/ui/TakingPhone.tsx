import type { ReactNode } from 'react';
import { Button } from '../../../shared/ui/Button.js';
import { useKeyboardOpen } from '../../../shared/hooks/useKeyboardOpen.js';
import { MemberLayout } from '../../../shared/ui/member/MemberLayout.js';
import { StripNav } from '../../../shared/ui/member/question-nav.js';
import { NavSheet, OfflineBanner, ShortcutHelp } from './ExamParts.js';

/** Exam-taking frame for phones/tablets: question strip on top, prev/next/submit bar at the bottom (hidden while the keyboard is up). */
export function TakingPhone({ title, name, online, clock, total, cur, answered, needsReason, content, dialog, sheet, help, onGo, onSubmit, onOpenSheet, onCloseSheet, onCloseHelp }: {
  title: string; name: string; online: boolean; clock: ReactNode; total: number; cur: number; answered: number[]; needsReason: number[]; content: ReactNode; dialog: ReactNode; sheet: boolean; help: boolean;
  onGo: (i: number) => void; onSubmit: () => void; onOpenSheet: () => void; onCloseSheet: () => void; onCloseHelp: () => void;
}) {
  const keyboardOpen = useKeyboardOpen();
  const last = cur === total - 1;
  const footer = keyboardOpen ? undefined : (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto minmax(0,1fr)', gap: 8 }}>
      <Button variant="secondary" size="lg" icon="chevron-left" ariaLabel="Câu trước" disabled={cur === 0} onClick={() => onGo(cur - 1)} style={{ padding: '0 14px' }}>Trước</Button>
      <Button variant={last ? 'secondary' : 'primary'} size="lg" iconRight="chevron-right" ariaLabel="Câu sau" disabled={last} onClick={() => onGo(cur + 1)} style={{ padding: '0 14px' }}>Sau</Button>
      <Button variant={last ? 'primary' : 'secondary'} size="lg" icon="send" block onClick={onSubmit} style={{ padding: '0 14px' }}>Nộp bài</Button>
    </div>
  );
  return (
    <MemberLayout sessionTitle={title} displayName={name} footer={footer}>
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {!online && <OfflineBanner compact />}
        {clock && <div style={{ position: 'sticky', top: 60, zIndex: 4, justifySelf: 'center' }}>{clock}</div>}
        <StripNav count={total} current={cur} answered={answered} needsReason={needsReason} onSelect={onGo} onOpenAll={onOpenSheet} />
        {content}
      </div>
      {sheet && <NavSheet count={total} current={cur} answered={answered} needsReason={needsReason} onSelect={onGo} onClose={onCloseSheet} onSubmit={onSubmit} />}
      {dialog}
      {help && <ShortcutHelp onClose={onCloseHelp} />}
    </MemberLayout>
  );
}
