import type { ReactNode } from 'react';
import type { MeResponse } from '../../../../shared/api/index.js';
import { useExamGateway } from '../application/exam-gateway-context.js';
import { ResultView } from '../../../shared/ui/member/ResultView.js';
import { EditRequestPanel } from './EditRequestPanel.js';
import { StartScreen } from './StartScreen.js';
import { TakingView } from './TakingView.js';

/**
 * The "active + running" step of the member flow: start screen, taking, or (after submitting) the provisional result.
 * `onChanged` asks the parent to refetch `/api/me`; `leaderboard` is shown under the result.
 */
export function MemberExamPage({ me, onChanged, leaderboard }: { me: MeResponse; onChanged: () => Promise<void>; leaderboard?: ReactNode }) {
  const gateway = useExamGateway();
  const { attempt } = me;
  if (attempt.current) return <TakingView key={attempt.current.id} me={me} attemptId={attempt.current.id} onChanged={onChanged} />;
  if (attempt.submitted.length > 0) return <ResultView me={me} ended={false}><EditRequestPanel me={me} onChanged={onChanged} />{leaderboard}</ResultView>;
  return <StartScreen me={me} onStart={async () => { await gateway.startAttempt(); await onChanged(); }} />;
}
