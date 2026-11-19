import { useEffect, useMemo, useRef, useState } from 'react';
import type { MeResponse } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { SaveIndicator } from '../../../shared/ui/SaveIndicator.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { useOnline } from '../../../shared/hooks/useOnline.js';
import { MemberPage, useIsDesk, useShowKeys } from '../../../shared/ui/member/member-shell.js';
import { useTakingExam } from '../application/use-taking-exam.js';
import { EMPTY_DRAFT, progressOf } from '../domain/answer-progress.js';
import { questionList } from '../domain/shortcuts.js';
import { QuestionContent } from './QuestionContent.js';
import { TakingDesktop } from './TakingDesktop.js';
import { TakingPhone } from './TakingPhone.js';
import { useExamShortcuts } from './use-exam-shortcuts.js';
import { useCountdown } from '../../../shared/hooks/useCountdown.js';
import { Countdown } from '../../../shared/ui/Countdown.js';
import { TimeUpOverlay } from './ExamParts.js';

/** The "taking" step: connects the controller to the desktop or phone frame. Holds only view state (overlays, focus). */
export function TakingView({ me, attemptId, onChanged }: { me: MeResponse; attemptId: number; onChanged: () => Promise<void> }) {
  const desk = useIsDesk();
  const showKeys = useShowKeys();
  const online = useOnline();
  const { state, ctrl } = useTakingExam(attemptId, onChanged);
  const [help, setHelp] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [typing, setTyping] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const { view, cur, drafts } = state;
  const questions = useMemo(() => view?.questions ?? [], [view]);
  const q = questions[cur];
  const { answered, unanswered, needsReason } = useMemo(() => progressOf(questions, drafts), [questions, drafts]);
  const timeLeft = useCountdown(me.session.timer);
  useEffect(() => {
    if (timeLeft === 0) ctrl?.timeUp();
    else if (timeLeft !== null) ctrl?.timeResumed();
  }, [timeLeft, ctrl]);

  // New question: back to the top, focus its heading (screen readers read "Câu 3/4").
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (mainRef.current) mainRef.current.scrollTop = 0; else window.scrollTo(0, 0);
    headRef.current?.focus({ preventScroll: true });
  }, [cur]);

  useExamShortcuts({ ctrl, q, cur, overlay: state.confirming || help || sheet || state.timeUp, help, sheet, onHelp: () => setHelp(true), onCloseHelp: () => setHelp(false), onCloseSheet: () => setSheet(false) });

  const title = me.session.title;
  const name = me.participant.displayName;
  if (!ctrl || state.loadError || !view || !q) {
    const body = state.loadError ? <ErrorMessage message={state.loadError} onRetry={() => void ctrl?.load()} /> : <Spinner block label="Đang tải bài làm…" />;
    return <MemberPage desk={desk} title={title} name={name} maxW={520}>{body}</MemberPage>;
  }

  const saveEl = <SaveIndicator state={online ? state.save : 'offline'} onRetry={() => void ctrl.retrySave()} />;
  const clock = timeLeft !== null ? <Countdown ms={timeLeft} size={desk ? 'md' : 'sm'} /> : null;
  const left = unanswered.length;
  const missing = needsReason.length;
  const goFix = (i: number) => { ctrl.cancelSubmit(); ctrl.go(i); };
  const dialog = missing > 0 ? (
    // PRODUCT.md §7.32b: a pick on a "hỏi lý do" question needs its reason before a manual submit.
    <ConfirmDialog open={state.confirming} title="Còn câu chưa ghi lý do" confirmLabel="Nộp bài" cancelLabel="Quay lại làm" confirmDisabled disabledReason="Ghi lý do cho các câu trên rồi nộp. Câu bỏ trống hoàn toàn thì không cần lý do."
      onCancel={() => ctrl.cancelSubmit()} onConfirm={() => {}}>
      <span style={{ display: 'grid', gap: 10 }}>
        <span>Bạn đã chọn đáp án nhưng chưa ghi lý do ở {missing} câu:</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {needsReason.map(i => <Button key={i} variant="secondary" size="sm" icon="message-square" onClick={() => goFix(i)}>Câu {i + 1}</Button>)}
        </span>
      </span>
    </ConfirmDialog>
  ) : (
    <ConfirmDialog open={state.confirming} title="Nộp bài?" confirmLabel="Nộp bài" cancelLabel="Làm tiếp" busy={state.submitting} confirmDisabled={!online} disabledReason="Đang mất kết nối — chờ có mạng rồi nộp."
      onCancel={() => ctrl.cancelSubmit()} onConfirm={() => void ctrl.submit()}>
      {left > 0 ? <><b>Còn {left} câu chưa trả lời</b> ({questionList(unanswered)}). </> : 'Bạn đã trả lời tất cả các câu. '}Sau khi nộp, bạn không sửa được bài nữa.
    </ConfirmDialog>
  );
  const content = (
    <QuestionContent q={q} cur={cur} total={questions.length} desk={desk} draft={drafts[q.id] ?? EMPTY_DRAFT} showKeys={showKeys} typing={typing} onTyping={setTyping}
      onPick={id => ctrl.pick(q, id)} onText={text => ctrl.setText(q.id, text)} onReason={reason => ctrl.setReason(q, reason)} saveEl={desk ? undefined : saveEl} headRef={headRef} closed={state.closed} submitError={state.submitError} />
  );
  const overlay = state.timeUp ? <TimeUpOverlay saving={state.save !== 'saved'} /> : null;
  const common = { title, name, online, cur, answered, needsReason, content, dialog: <>{dialog}{overlay}</>, clock, help, onGo: (i: number) => ctrl.go(i), onSubmit: () => ctrl.requestSubmit(), onCloseHelp: () => setHelp(false) };

  return desk
    ? <TakingDesktop {...common} saveEl={saveEl} questions={questions} showKeys={showKeys} mainRef={mainRef} onHelp={() => setHelp(true)} />
    : <TakingPhone {...common} total={questions.length} sheet={sheet} onOpenSheet={() => setSheet(true)} onCloseSheet={() => setSheet(false)} />;
}
