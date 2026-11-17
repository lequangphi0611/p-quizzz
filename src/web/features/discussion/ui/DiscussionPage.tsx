import { useCallback, useMemo, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Icon } from '../../../shared/ui/Icon.js';
import { useFullscreen } from '../../../shared/hooks/useFullscreen.js';
import { useDiscussion } from '../application/use-discussion.js';
import { questionIndexFromSearch, questionProgress, splitPapers } from '../domain/discussion-ui.js';
import { draftOf } from '../domain/grade-draft.js';
import { ChoiceView } from './ChoiceView.js';
import { DiscussionScreen } from './DiscussionScreen.js';
import { EssayList } from './EssayList.js';
import { PaperView } from './PaperView.js';
import { StateView } from './StateView.js';
import { useDiscussionKeys } from './use-discussion-keys.js';

// "/admin/sessions/:id/discuss" — S17. Shown on the projector from the mentor's laptop after the session closes:
// one question at a time, anonymous essays graded together. Each question opens with only the question on screen: the
// class's work (B) and the answer (Space) are two separate covers the mentor lifts in either order (S25).
// No names anywhere: the API sends none, and nothing here asks for them.
export function DiscussionPage() {
  const sessionId = Number(useParams().id);
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { state, ctrl } = useDiscussion(sessionId);
  const { fullscreen, toggle: toggleFs, leave } = useFullscreen();
  const { view, load, mode, paperIdx, drafts } = state;

  const qs = view?.questions ?? [];
  const qi = questionIndexFromSearch(search.toString(), qs.length);
  const q = qs[qi];
  const { papers, blanks } = useMemo(() => (q?.type === 'essay' ? splitPapers(q) : { papers: [], blanks: [] }), [q]);
  const locked = view?.status === 'finalized';
  const remaining = view ? view.total - view.graded : 0;
  const empty = load === 'ready' && view !== null && (view.submitted === 0 || qs.length === 0);
  const ready = load === 'ready' && !empty && !!q;
  const exit = useCallback(() => { leave(); navigate(`/admin/sessions/${sessionId}`); }, [leave, navigate, sessionId]);
  const goQ = useCallback((i: number) => {
    if (qs.length === 0) return;
    setSearch({ q: String(Math.max(0, Math.min(qs.length - 1, i)) + 1) }, { replace: true });
    ctrl?.questionChanged();
  }, [qs.length, setSearch, ctrl]);

  const revealed = q ? state.revealed.has(q.id) : false;
  const work = q ? state.work.has(q.id) : false;
  useDiscussionKeys({ dialog: state.dialog, finalizing: state.finalizing, ready, hasPapers: q?.type === 'essay' && papers.length > 0, workShown: work, mode, fullscreen }, action => {
    if (!ctrl || !q) { if (action.kind === 'closeDialog') ctrl?.closeFinalize(); return; }
    if (action.kind === 'closeDialog') ctrl.closeFinalize();
    else if (action.kind === 'question') goQ(qi + action.delta);
    else if (action.kind === 'toggleAnswer') ctrl.toggleReveal(q.id);
    else if (action.kind === 'toggleWork') ctrl.toggleWork(q.id);
    else if (action.kind === 'paper') ctrl.stepPaper(papers, action.dir);
    else ctrl.backToList();
  });

  const essayProgress = qs.map(x => (x.type === 'essay' && x.answers.length > 0 ? questionProgress(x) : null));
  const meta: ReactNode = ready && view && view.total > 0 && (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, font: '500 22px/1 var(--font-sans)', color: remaining === 0 ? 'var(--screen-correct)' : 'var(--screen-meta)', whiteSpace: 'nowrap' }}>
      <Icon name={remaining === 0 ? 'circle-check' : 'pencil'} size={22} />Đã chấm <b style={{ font: '700 24px/1 var(--font-mono)', color: remaining === 0 ? undefined : '#fff' }}>{view.graded}/{view.total}</b>
    </span>
  );

  let content: ReactNode;
  const toggle = () => { if (q) ctrl?.toggleReveal(q.id); };
  const toggleWork = () => { if (q) ctrl?.toggleWork(q.id); };
  if (load !== 'ready' || !ready) content = <StateView kind={load === 'loading' ? 'loading' : load === 'error' ? 'error' : 'empty'} message={state.loadError} onRetry={() => void ctrl?.load()} onExit={exit} />;
  else if (q!.type !== 'essay') content = <ChoiceView q={q!} index={qi} submitted={view!.submitted} revealed={revealed} onToggle={toggle} work={work} onToggleWork={toggleWork} />;
  else if (!work || mode === 'list' || !papers[paperIdx]) content = <EssayList q={q!} index={qi} revealed={revealed} onToggle={toggle} work={work} onToggleWork={toggleWork} papers={papers} blanks={blanks} lastOpened={state.lastOpened} locked={locked} zeroing={state.zeroing} onOpen={i => ctrl?.openPaper(i)} onZeroBlanks={() => void ctrl?.zeroBlanks(blanks)} />;
  else {
    const a = papers[paperIdx]!;
    content = (
      <PaperView q={q!} index={qi} revealed={revealed} onToggle={toggle} papers={papers} paperIdx={paperIdx} draft={drafts[a.answerId] ?? draftOf(a)} locked={locked}
        onScore={v => ctrl?.editScore(a, v)} onFeedback={v => ctrl?.editFeedback(a, v)}
        onCommitScore={(v, enter) => void ctrl?.commitScore(q!, papers, v, enter)} onCommitFeedback={() => void ctrl?.commitFeedback(q!, papers)}
        onNav={d => ctrl?.openPaper(Math.max(0, Math.min(papers.length - 1, paperIdx + d)))} onBack={() => ctrl?.backToList()} />
    );
  }

  // J K stays in the strip (dimmed when unusable) so the hints never jump between questions.
  const hints: [string, string, boolean?][] = [['← →', 'câu'], ['B', 'bài làm'], ['Space', 'đáp án'], ['J K', 'bài', q?.type !== 'essay' || !work], ['Esc', 'thoát toàn màn hình']];
  const navMarks = qs.map(x => ({ work: state.work.has(x.id), answer: state.revealed.has(x.id) }));
  return (
    <DiscussionScreen examTitle={view?.examTitle} status={view?.status} meta={meta} fullscreen={fullscreen} ready={ready} locked={locked} canFinalize={ready && !locked}
      count={qs.length} current={qi} navMeta={essayProgress.map(p => (p ? `${p.graded}/${p.total}` : null))} navDone={essayProgress.flatMap((p, i) => (p && p.graded === p.total ? [i] : []))} navMarks={navMarks} revealStatus={{ work, answer: revealed }} hints={hints}
      remaining={remaining} dialog={state.dialog} finalizing={state.finalizing} finalizeError={state.finalizeError} contentKey={`${load}-${qi}-${mode}`}
      onGo={goQ} onToggleFullscreen={toggleFs} onFinalizeOpen={() => ctrl?.openFinalize()} onFinalizeCancel={() => ctrl?.closeFinalize()} onFinalizeConfirm={() => void ctrl?.finalize()} onExit={exit}>
      {content}
    </DiscussionScreen>
  );
}
