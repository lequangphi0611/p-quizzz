import { useEffect, useRef } from 'react';
import type { TrainingEventRow } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Kbd } from '../../../shared/ui/Kbd.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import type { PanelKind, PanelState } from '../application/training-controller.js';
import { changeLines, clipView } from '../domain/clip-view.js';
import { formatDuration } from '../domain/duration.js';
import { shortenTarget } from '../domain/shorten.js';

const codeFont = '400 13px/1.6 var(--font-mono)';
const pre = { margin: 0, font: codeFont, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--ink-900)' } as const;

function ClipText({ text, diff }: { text: string; diff: boolean }) {
  if (!diff) return <pre style={pre}>{text}</pre>;
  return (
    <pre style={pre}>
      {changeLines(text).map((l, i) => (
        <span key={i} style={{ display: 'block', background: l.kind === 'add' ? 'var(--correct-surface)' : l.kind === 'del' ? 'var(--wrong-surface)' : undefined, color: l.kind === 'add' ? 'var(--correct-600)' : l.kind === 'del' ? 'var(--wrong-600)' : undefined }}>
          {l.text || ' '}
        </span>
      ))}
    </pre>
  );
}

/**
 * The right-hand panel: the output or the change of one command in a scrolling box of its own, monospace, first lines,
 * "… đã lược bỏ N dòng …", last lines. J / K go to the previous / next command, Esc closes (the page returns the focus).
 */
export function EventPanel({ panel, event, onKind, onClose, onRetry, onStep }: {
  panel: PanelState; event: TrainingEventRow | undefined; onKind: (k: PanelKind) => void; onClose: () => void; onRetry: () => void; onStep: (dir: 1 | -1) => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  const eventId = panel.eventId;
  // Opening (or stepping to another command) puts the focus on the text, so the arrow keys scroll it and Esc is heard.
  useEffect(() => { body.current?.focus({ preventScroll: true }); body.current?.scrollTo({ top: 0 }); }, [eventId, panel.kind]);

  const target = shortenTarget(event?.toolTarget ?? '', 60);
  const both = !!event?.hasOutput && !!event?.hasChange;
  const view = panel.clip ? clipView(panel.clip) : null;
  // An Edit is stored as `- old` / `+ new` lines; a written file is plain text (its own "- item" lines must not turn red).
  const diff = panel.kind === 'change' && (event?.toolName === 'Edit' || event?.toolName === 'MultiEdit');
  const title = panel.kind === 'output' ? 'Output' : 'Thay đổi';

  return (
    <aside aria-label={`${title} của lệnh`} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%', background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, font: 'var(--type-h2)', fontSize: 16, color: 'var(--text-title)' }}>{title}</h2>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <Button variant="ghost" size="sm" icon="chevron-left" ariaLabel="Lệnh trước (K)" onClick={() => onStep(-1)} />
            <Button variant="ghost" size="sm" icon="chevron-right" ariaLabel="Lệnh sau (J)" onClick={() => onStep(1)} />
            <Button variant="ghost" size="sm" icon="x" ariaLabel="Đóng (Esc)" onClick={onClose} />
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ font: '700 13px/1 var(--font-mono)', color: 'var(--text-title)' }}>{event?.toolName}</span>
          <span title={event?.toolTarget} style={{ font: '500 13px/1.4 var(--font-mono)', color: 'var(--ink-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{target.text}</span>
          {event?.durationMs !== undefined && <span style={{ marginLeft: 'auto', font: '500 12px/1 var(--font-mono)', color: 'var(--text-meta)', whiteSpace: 'nowrap' }}>{formatDuration(event.durationMs)}</span>}
        </div>
        {both && <SegmentedControl size="sm" ariaLabel="Nội dung cần xem" value={panel.kind} onChange={onKind} items={[{ value: 'output', label: 'Output' }, { value: 'change', label: 'Thay đổi' }]} />}
      </div>

      <div ref={body} tabIndex={0} role="region" aria-label={`${title}, cuộn để đọc`} aria-busy={panel.phase === 'loading'}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14, background: 'var(--surface-sunken)', outline: 'none' }}>
        {panel.phase === 'loading' ? (
          <Spinner label="Đang tải…" block />
        ) : panel.phase === 'error' ? (
          <ErrorMessage title="Không tải được nội dung" message={panel.error} onRetry={onRetry} />
        ) : !view ? (
          <p style={{ margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Lệnh này không có {panel.kind === 'output' ? 'output' : 'thay đổi'} nào được lưu.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <ClipText text={view.head} diff={diff} />
            {view.omitted && (
              <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-meta)', font: '600 12px/1 var(--font-mono)' }}>
                <span style={{ flex: 1, borderTop: '1px dashed var(--ink-400)' }} />{view.omitted}<span style={{ flex: 1, borderTop: '1px dashed var(--ink-400)' }} />
              </div>
            )}
            {view.tail !== null && <ClipText text={view.tail} diff={diff} />}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, padding: '8px 14px', borderTop: '1px solid var(--border-hairline)', font: 'var(--type-meta)', color: 'var(--text-meta)', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Kbd>K</Kbd> lệnh trước</span>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Kbd>J</Kbd> lệnh sau</span>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Kbd>Esc</Kbd> đóng</span>
      </div>
    </aside>
  );
}
