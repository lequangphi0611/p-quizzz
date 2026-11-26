import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router';
import { TEACHING_COMMENT_MAX, TEACHING_TEXT_MAX } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import type { TrainingController, TrainingState } from '../application/training-controller.js';
import { fieldNames, fieldOrigin, footerView, isDrafting, saveEnabled } from '../domain/example-draft.js';
import { isTypingTarget } from '../domain/shortcuts.js';
import { DraftBanner, DraftTextField, DraftTopicField, LabelToggle, PromptBlock, ReadTick, SuspectAlert, WritingBlock, labelTagOf } from './ExampleDialogParts.js';

const WAITING = 'Gõ tay được trong lúc chờ. Nháp về sẽ hỏi trước khi thay chữ của bạn.';

/**
 * "Ví dụ" of one prompt (S44) with the AI draft of S45: label (required, never chosen for the mentor), topic, comment (required), a better version
 * (optional), or drop the example. Variants: writing, ready, edited, flagged, failed, AI off, and the question before a draft replaces typed text.
 * Keys: 1 / 2 choose the label (outside a text box), Ctrl+Enter saves, Esc closes (a draft keeps running).
 */
export function ExampleDialog({ state, ctrl }: { state: TrainingState; ctrl: TrainingController }) {
  const e = state.teachingEdit!;
  const { ai, form } = e;
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLDivElement>(null);
  const row = ai.row;
  const draft = row?.status === 'done' ? row.draft : null;
  const writing = ai.requesting || (row !== null && isDrafting(row.status));
  const failed = !writing && (ai.error !== '' || row?.status === 'failed');
  const suspicious = draft?.suspicious ?? false;
  const ready = e.phase === 'ready';
  const gate = { form, suspicious, ack: ai.ack };
  const canSave = ready && !e.saving && !ai.overwrite && saveEnabled(gate);
  const footer = ready ? footerView(gate, ai.applied) : null;
  const showOffLink = ready && !ai.available && row === null;
  const suggested = draft?.label ?? null;
  const labelTag = labelTagOf(form.label, suggested, draft !== null);
  const field = (f: 'topic' | 'comment' | 'betterPrompt') => fieldOrigin(f, form, ai.applied);
  const locked = e.saving || !ready;

  // The focus goes in when the form shows: to the label when there is a draft (to read it first), else to the comment.
  useEffect(() => {
    if (!ready) { root.current?.focus({ preventScroll: true }); return; }
    const target = draft ? root.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') : root.current?.querySelector<HTMLElement>('textarea');
    (target ?? root.current)?.focus({ preventScroll: true });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // Closing hands the focus back to the button of the prompt.
  useEffect(() => () => { requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-teaching="${e.eventId}"]`)?.focus()); }, [e.eventId]);
  // The question about typed text takes the focus (the safe answer first).
  useEffect(() => { if (ai.overwrite) askRef.current?.querySelector('button')?.focus(); }, [ai.overwrite]);

  function onKeyDown(ev: React.KeyboardEvent) {
    if (ai.overwrite) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ctrl.resolveDraftOverwrite(false); }
      return;
    }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ctrl.closeTeaching(); return; }
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); if (canSave) void ctrl.saveTeaching(); return; }
    if ((ev.key === '1' || ev.key === '2') && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !isTypingTarget(ev.target as HTMLElement) && ready && !e.saving) {
      ev.preventDefault();
      ctrl.setTeachingForm({ label: ev.key === '1' ? 'good' : 'needs_work' });
    }
  }

  return (
    <>
    <div onClick={ev => { if (ev.target === ev.currentTarget && !e.saving && !ai.overwrite) ctrl.closeTeaching(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16, animation: 'pq-fade var(--dur-base) var(--ease-standard)' }}>
      <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} data-example-dialog data-draft-state={writing ? 'writing' : failed ? 'failed' : draft ? 'ready' : 'none'} onKeyDown={onKeyDown}
        style={{ position: 'relative', width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', background: 'var(--paper)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-dialog)', overflow: 'hidden', outline: 'none', animation: 'pq-pop-in var(--dur-slow) var(--ease-standard)' }}>
        <div style={{ padding: '24px 24px 12px', display: 'grid', gap: 6 }}>
          <h3 id={titleId} style={{ margin: 0, font: 'var(--type-h2)', fontSize: 22, color: 'var(--text-title)' }}>Ví dụ</h3>
          <p style={{ margin: 0, font: 'var(--type-meta)', fontSize: 14, color: 'var(--text-meta)' }}>
            Nhãn và nhận xét là của <b style={{ color: 'var(--ink-800)' }}>ví dụ</b>, không phải của {state.hidden ? 'bạn ấy' : e.memberName}. Bạn ấy không thấy, và không vào số liệu, cờ hay báo cáo.
          </p>
        </div>

        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '4px 24px 16px', display: 'grid', gridAutoRows: 'max-content', gap: 16, alignContent: 'start' }}>
          {suspicious && draft && <SuspectAlert reason={draft.suspiciousReason} />}
          <PromptBlock prompt={e.prompt} quote={suspicious && draft ? draft.suspiciousQuote : ''} hidden={state.hidden} />

          {e.phase === 'loading' && <div role="status" style={{ color: 'var(--text-meta)' }}>{e.exists ? 'Đang tải ví dụ…' : 'Đang tải nháp…'}</div>}
          {e.phase === 'error' && <ErrorMessage message={e.error} onRetry={() => ctrl.retryTeaching()} />}
          {ready && (
            <>
              {writing && <WritingBlock since={row?.createdAt} />}
              {!writing && draft && <DraftBanner sampleCount={row?.sampleCount ?? null} busy={e.saving || ai.requesting} onRegenerate={() => ctrl.regenerateDraft()} onDiscard={() => ctrl.discardDraft()} />}
              {failed && (
                <ErrorMessage title={`Không viết được nháp: ${ai.error || row?.error || 'không rõ lý do'}`} message="Bạn vẫn tự viết được, hoặc thử lại." retryLabel="Viết lại nháp" onRetry={() => ctrl.regenerateDraft()} />
              )}

              <div role="group" aria-labelledby={`${titleId}-label`} style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span id={`${titleId}-label`} style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Nhãn (bắt buộc)</span>
                  <span style={{ flexGrow: 1 }} />
                  {labelTag && <span data-label-tag style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '600 12px/1 var(--font-sans)', color: 'var(--ink-600)' }}><Icon name={labelTag.icon} size={13} />{labelTag.text}</span>}
                </div>
                <LabelToggle value={form.label} suggested={suggested} disabled={locked} onChange={l => ctrl.setTeachingForm({ label: l })} />
              </div>
              <DraftTopicField value={form.topic} origin={field('topic')} disabled={locked} onChange={t => ctrl.setTeachingForm({ topic: t })} />
              <DraftTextField label="Nhận xét (bắt buộc)" value={form.comment} origin={field('comment')} placeholder={writing ? WAITING : undefined} maxLength={TEACHING_COMMENT_MAX} disabled={locked}
                hint="Nói về cách viết prompt trong tình huống này, không nói về người viết." onChange={v => ctrl.setTeachingForm({ comment: v })} />
              <DraftTextField label="Phiên bản tốt hơn (tuỳ chọn)" value={form.betterPrompt} origin={field('betterPrompt')} placeholder={writing ? WAITING : undefined} maxLength={TEACHING_TEXT_MAX} disabled={locked}
                onChange={v => ctrl.setTeachingForm({ betterPrompt: v })} />
              {suspicious && <ReadTick checked={ai.ack} disabled={locked} onChange={v => ctrl.setDraftAck(v)} />}
              {e.error && <ErrorMessage message={e.error} />}
              {e.exists && <div><Button variant="ghost" size="sm" icon="trash-2" disabled={e.saving} onClick={() => void ctrl.removeTeaching()}>Bỏ ví dụ này</Button></div>}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px 20px', borderTop: '1px solid var(--border-hairline)', flexWrap: 'wrap' }}>
          {showOffLink && (
            <>
              <Link to="/admin/ai-grader-help" target="_blank" rel="noopener" data-ai-help style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: '600 13px/1 var(--font-sans)' }}>
                <Icon name="sparkles" size={14} />Cách bật AI<Icon name="external-link" size={12} />
              </Link>
              <span style={{ font: 'var(--type-meta)', fontSize: 12, color: 'var(--text-meta)' }}>để AI viết nháp giúp bạn</span>
            </>
          )}
          {footer && (
            <span data-example-footer role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'var(--type-meta)', color: footer.warn ? 'var(--warn-600)' : 'var(--text-meta)' }}>
              <Icon name={footer.icon} size={14} />{footer.text}
            </span>
          )}
          <span style={{ flexGrow: 1 }} />
          <Button variant="ghost" disabled={e.saving} onClick={() => ctrl.closeTeaching()}>Đóng</Button>
          <Button variant="primary" icon={canSave || e.saving ? 'save' : 'lock'} shortcut="Ctrl ↵" loading={e.saving} disabled={!canSave} onClick={() => void ctrl.saveTeaching()}>Lưu ví dụ</Button>
        </div>
      </div>
    </div>
    {ai.overwrite && (
      <div ref={askRef} onKeyDown={ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ctrl.resolveDraftOverwrite(false); } }}>
        <ConfirmDialog title="Thay nội dung đang có bằng nháp AI?" confirmLabel="Dùng nháp AI" cancelLabel="Giữ nội dung của tôi" width={440}
          onConfirm={() => ctrl.resolveDraftOverwrite(true)} onCancel={() => ctrl.resolveDraftOverwrite(false)}>
          Bạn đã gõ vào {ai.overwrite.fields.length > 1 ? 'các ô' : 'ô'} <b>{fieldNames(ai.overwrite.fields)}</b>. Nếu giữ, chỉ {ai.overwrite.fields.length > 1 ? 'các ô đó giữ' : 'ô đó giữ'} chữ của bạn; các ô khác vẫn được điền nháp.
        </ConfirmDialog>
      </div>
    )}
    </>
  );
}
