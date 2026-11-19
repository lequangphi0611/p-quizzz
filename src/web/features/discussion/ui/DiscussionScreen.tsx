import type { ReactNode } from 'react';
import { QuestionNav } from '../../../shared/ui/QuestionNav.js';
import { ScreenLayout } from '../../../shared/ui/screen/ScreenLayout.js';
import { ScreenStage } from '../../../shared/ui/screen/ScreenStage.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { st } from './styles.js';

/** Projector frame of the discussion: top bar, question strip, content area, key hints and the finalize dialog. */
export function DiscussionScreen({ examTitle, status, meta, fullscreen, ready, locked, canFinalize, count, current, navMeta, navDone, navLabels, priority, hints, remaining, dialog, finalizing, finalizeError, contentKey, reasonsChip, children, onGo, onTogglePriority, onToggleFullscreen, onFinalizeOpen, onFinalizeCancel, onFinalizeConfirm, onExit }: {
  examTitle?: string; status?: 'lobby' | 'running' | 'closed' | 'finalized'; meta: ReactNode; fullscreen: boolean; ready: boolean; locked: boolean; canFinalize: boolean;
  count: number; current: number; navMeta: (string | null)[]; navDone: number[]; navLabels: number[]; priority: boolean; hints: [string, string][]; remaining: number;
  dialog: boolean; finalizing: boolean; finalizeError?: string; contentKey: string;
  /** `{reason}` question on screen (S30): whether its reasons are shown. `null` = the question asks no reason. */
  reasonsChip?: boolean | null; children: ReactNode;
  onGo: (i: number) => void; onTogglePriority: () => void; onToggleFullscreen: () => void; onFinalizeOpen: () => void; onFinalizeCancel: () => void; onFinalizeConfirm: () => void; onExit: () => void;
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
                <QuestionNav size="screen" count={count} current={current} meta={navMeta} labels={navLabels} answered={navDone} onSelect={onGo} />
              </div>
              <Button tone="screen" variant="secondary" size="xl" icon="chevron-right" ariaLabel="Câu sau (→)" disabled={current === count - 1} onClick={() => onGo(current + 1)} />
              <div style={{ marginLeft: 'auto', flex: 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Neutral wording on purpose: the projector must not say why a question comes first (PRODUCT.md §7.30c). */}
                {reasonsChip != null && (
                  <span role="status" aria-label={`Lý do: ${reasonsChip ? 'đã hiện' : 'đang ẩn'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 52, padding: '0 18px 0 14px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap', boxSizing: 'border-box', border: '2px ' + (reasonsChip ? 'solid var(--sun-400)' : 'dashed var(--screen-line-strong)'), background: reasonsChip ? 'var(--screen-pending-surface)' : 'transparent', color: reasonsChip ? 'var(--screen-text)' : 'var(--screen-meta)', font: '600 24px/1 var(--font-sans)' }}>
                    <Icon name="message-square" size={24} style={{ color: reasonsChip ? 'var(--sun-400)' : undefined }} />Lý do
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 10, borderLeft: '2px solid ' + (reasonsChip ? 'rgba(255,210,63,.35)' : 'var(--screen-line)'), color: reasonsChip ? 'var(--sun-400)' : 'var(--screen-meta)', fontWeight: reasonsChip ? 700 : 500 }}>
                      <Icon name={reasonsChip ? 'eye' : 'eye-off'} size={22} />{reasonsChip ? 'Đã hiện' : 'Đang ẩn'}
                    </span>
                  </span>
                )}
                <Button tone="screen" variant={priority ? 'primary' : 'secondary'} size="xl" icon={priority ? 'check' : 'list'} pressed={priority} shortcut="S" onClick={onTogglePriority}>Cần bàn trước</Button>
                {locked && <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 'var(--radius-pill)', border: '2px solid var(--brand-200)', color: 'var(--brand-200)', font: '600 22px/1 var(--font-sans)' }}><Icon name="lock" size={22} />Đã chốt — chỉ xem</span>}
              </div>
            </div>
          )}
          <div key={contentKey} style={{ flex: 1, minHeight: 0, padding: '32px 40px 76px', animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}>{children}</div>
          {ready && (
            <div aria-hidden="true" style={{ position: 'absolute', right: 40, bottom: 20, display: 'flex', gap: 22, alignItems: 'center', font: '400 20px/1 var(--font-sans)', color: 'var(--screen-meta)' }}>
              {hints.map(([keys, text]) => <span key={keys} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{keys.split(' ').map(x => <kbd key={x} style={st.kbd}>{x}</kbd>)}{text}</span>)}
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
