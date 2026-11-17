import type { ReactNode } from 'react';
import { QuestionNav, type QuestionMark } from '../../../shared/ui/QuestionNav.js';
import { ScreenLayout } from '../../../shared/ui/screen/ScreenLayout.js';
import { ScreenStage } from '../../../shared/ui/screen/ScreenStage.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { RevealStatus } from './RevealStatus.js';
import { st } from './styles.js';

/** Projector frame of the discussion: top bar, question strip, content area, key hints and the finalize dialog. */
export function DiscussionScreen({ examTitle, status, meta, fullscreen, ready, locked, canFinalize, count, current, navMeta, navDone, navMarks, revealStatus, hints, remaining, dialog, finalizing, finalizeError, contentKey, children, onGo, onToggleFullscreen, onFinalizeOpen, onFinalizeCancel, onFinalizeConfirm, onExit }: {
  examTitle?: string; status?: 'lobby' | 'running' | 'closed' | 'finalized'; meta: ReactNode; fullscreen: boolean; ready: boolean; locked: boolean; canFinalize: boolean;
  count: number; current: number; navMeta: (string | null)[]; navDone: number[]; navMarks: QuestionMark[]; revealStatus: { work: boolean; answer: boolean };
  /** [keys, label, off]: an `off` hint stays in place but dimmed, so the strip never jumps between questions. */
  hints: [string, string, boolean?][]; remaining: number;
  dialog: boolean; finalizing: boolean; finalizeError?: string; contentKey: string; children: ReactNode;
  onGo: (i: number) => void; onToggleFullscreen: () => void; onFinalizeOpen: () => void; onFinalizeCancel: () => void; onFinalizeConfirm: () => void; onExit: () => void;
}) {
  const actions = (
    <>
      <Button tone="screen" variant="ghost" size="xl" icon="maximize" onClick={onToggleFullscreen}>{fullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</Button>
      {canFinalize && <Button tone="screen" variant="secondary" size="xl" icon="flag" onClick={onFinalizeOpen}>Chốt kết quả</Button>}
      <Button tone="screen" variant="ghost" size="xl" icon="log-out" onClick={onExit}>Thoát</Button>
    </>
  );
  return (
    <ScreenStage>
      <ScreenLayout density="compact" examTitle={examTitle} status={status} meta={meta} actions={actions}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {ready && (
            <div style={{ flex: 'none', height: 112, padding: '0 40px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid var(--screen-line)' }}>
              <Button tone="screen" variant="secondary" size="xl" icon="chevron-left" ariaLabel="Câu trước (←)" disabled={current === 0} onClick={() => onGo(current - 1)} />
              <div className="pq-scroll" style={{ minWidth: 0, overflowX: 'auto', padding: '4px 2px' }}>
                <QuestionNav size="screen" count={count} current={current} meta={navMeta} marks={navMarks} answered={navDone} onSelect={onGo} />
              </div>
              <Button tone="screen" variant="secondary" size="xl" icon="chevron-right" ariaLabel="Câu sau (→)" disabled={current === count - 1} onClick={() => onGo(current + 1)} />
              <span style={{ marginLeft: 'auto', flex: 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                {locked && <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 'var(--radius-pill)', border: '2px solid var(--brand-200)', color: 'var(--brand-200)', font: '600 22px/1 var(--font-sans)', whiteSpace: 'nowrap' }}><Icon name="lock" size={22} />Đã chốt — chỉ xem</span>}
                <RevealStatus work={revealStatus.work} answer={revealStatus.answer} />
              </span>
            </div>
          )}
          <div key={contentKey} style={{ flex: 1, minHeight: 0, padding: '32px 40px 76px', animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}>{children}</div>
          {ready && (
            <div aria-hidden="true" style={{ position: 'absolute', right: 40, bottom: 20, display: 'flex', gap: 22, alignItems: 'center', font: '400 20px/1 var(--font-sans)', color: 'var(--screen-meta)' }}>
              {hints.map(([keys, text, off]) => <span key={keys} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: off ? 0.35 : 1, transition: 'opacity var(--dur-base) var(--ease-standard)' }}>{keys.split(' ').map(x => <kbd key={x} style={st.kbd}>{x}</kbd>)}{text}</span>)}
            </div>
          )}
        </div>
        <ConfirmDialog open={dialog} size="screen" title="Chốt kết quả?" confirmLabel="Chốt kết quả" cancelLabel="Huỷ" busy={finalizing} confirmDisabled={remaining > 0}
          disabledReason={<>Còn <b style={st.mono}>{remaining}</b> bài chưa chấm — chấm xong mới chốt được</>}
          onCancel={onFinalizeCancel} onConfirm={onFinalizeConfirm}>
          Điểm sẽ thành chính thức, bảng xếp hạng bỏ nhãn "Tạm tính" và không sửa điểm được nữa.
          {finalizeError && <div style={{ marginTop: 20 }}><ErrorMessage size="screen" message={finalizeError} /></div>}
        </ConfirmDialog>
      </ScreenLayout>
    </ScreenStage>
  );
}
