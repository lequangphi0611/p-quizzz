import type { ReactNode, Ref } from 'react';
import type { MemberQuestion } from '../../../../shared/api/index.js';
import { Button } from '../../../components/ui/Button.js';
import { Icon } from '../../../components/ui/Icon.js';
import { Kbd } from '../../../components/ui/Kbd.js';
import { StatusBadge } from '../../../components/ui/StatusBadge.js';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery.js';
import { WIDE_MIN } from '../../../shared/ui/member/breakpoints.js';
import { MemberLayout } from '../../../shared/ui/member/MemberLayout.js';
import { mText } from '../../../shared/ui/member/member-shell.js';
import { SideNav } from '../../../shared/ui/member/question-nav.js';
import { OfflineBanner, Progress, ShortcutHelp } from './ExamParts.js';

/** Exam-taking frame for desktop (S18): header with save state, sidebar with progress and navigation, sticky prev/next bar. */
export function TakingDesktop({ title, name, online, saveEl, questions, cur, answered, content, dialog, showKeys, help, mainRef, onGo, onSubmit, onHelp, onCloseHelp }: {
  title: string; name: string; online: boolean; saveEl: ReactNode; questions: MemberQuestion[]; cur: number; answered: number[]; content: ReactNode; dialog: ReactNode;
  showKeys: boolean; help: boolean; mainRef: Ref<HTMLElement>; onGo: (i: number) => void; onSubmit: () => void; onHelp: () => void; onCloseHelp: () => void;
}) {
  const wide = useMediaQuery(`(min-width: ${WIDE_MIN}px)`);
  const total = questions.length;
  const sidebar = (
    <>
      <div style={{ padding: '20px 20px 12px', display: 'grid', gap: 12 }}><span style={mText.label}>Tiến độ</span><Progress done={answered.length} total={total} /></div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px' }}><SideNav questions={questions} current={cur} answered={answered} onSelect={onGo} /></div>
      <div style={{ padding: '16px 20px 18px', borderTop: '1px solid var(--border-hairline)', display: 'grid', gap: 10 }}>
        <Button size="lg" block icon="send" onClick={onSubmit}>Nộp bài</Button>
        <button type="button" onClick={onHelp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 32, background: 'none', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', font: 'var(--type-meta)', color: 'var(--text-meta)' }}><Icon name="info" size={14} />Phím tắt <Kbd>?</Kbd></button>
      </div>
    </>
  );
  const pad = wide ? '0 48px' : '0 24px';
  return (
    <MemberLayout variant="wide" sessionTitle={title} displayName={name} status={<StatusBadge status="running" label="Đang làm bài" />} headerEnd={saveEl} banner={!online && <OfflineBanner />} sidebar={sidebar} compact={!wide} mainRef={mainRef}>
      <div style={{ flex: 1, padding: wide ? '40px 48px' : '28px 24px 32px' }}><div style={{ maxWidth: 960, margin: '0 auto' }}>{content}</div></div>
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--paper)', borderTop: '1px solid var(--border-hairline)', padding: '12px 0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: pad, boxSizing: 'content-box', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="secondary" icon="chevron-left" shortcut={showKeys ? '←' : undefined} disabled={cur === 0} onClick={() => onGo(cur - 1)}>Câu trước</Button>
          <span style={{ flex: 1 }} />
          <Button variant="secondary" iconRight="chevron-right" shortcut={showKeys ? '→' : undefined} disabled={cur === total - 1} onClick={() => onGo(cur + 1)}>Câu sau</Button>
        </div>
      </div>
      {dialog}
      {help && <ShortcutHelp onClose={onCloseHelp} />}
    </MemberLayout>
  );
}
