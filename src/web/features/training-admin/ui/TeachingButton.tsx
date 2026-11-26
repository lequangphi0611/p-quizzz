import type { TrainingEventRow } from '../../../../shared/api/index.js';
import { useReducedMotion } from '../../../shared/hooks/useStartNotices.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { exampleButtonName, exampleButtonView, type ExampleButtonKind } from '../domain/example-draft.js';

const base = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 'var(--radius-md)', font: '600 13px/1 var(--font-sans)', whiteSpace: 'nowrap', flex: 'none', cursor: 'pointer' } as const;

const LOOKS: Record<ExampleButtonKind, { border: string; bg: string; fg: string }> = {
  new: { border: '1px solid var(--brand-200)', bg: 'var(--paper)', fg: 'var(--brand-700)' },
  drafting: { border: '1.5px dashed var(--ink-400)', bg: 'var(--paper)', fg: 'var(--ink-700)' },
  unseen: { border: '1.5px dashed var(--ink-700)', bg: 'var(--ink-050)', fg: 'var(--ink-900)' },
  unseenSuspect: { border: '1.5px dashed var(--warn-600)', bg: 'var(--warn-surface)', fg: 'var(--warn-600)' },
  unsaved: { border: '1.5px dashed var(--ink-400)', bg: 'var(--paper)', fg: 'var(--ink-700)' },
  failed: { border: '1px solid var(--wrong-border)', bg: 'var(--paper)', fg: 'var(--wrong-600)' },
  savedGood: { border: '1px solid var(--correct-border)', bg: 'var(--correct-surface)', fg: 'var(--correct-600)' },
  savedNeedsWork: { border: '1px solid var(--ink-300)', bg: 'var(--ink-100)', fg: 'var(--ink-800)' },
};

/**
 * The example button of a prompt (PRODUCT.md §7.39b, §7.40): "Làm ví dụ", the states of an AI draft (writing, ready, flagged, opened and not
 * saved, failed) and the saved example ("Ví dụ: Tốt" green, "Ví dụ: Chưa tốt" neutral grey: the label is about the prompt). Every state has an icon
 * and words, never colour alone; a dashed border means "the AI wrote this, it is not yours yet". A member who did not agree gets no button at all
 * (the lock is a chip in the member's header). `context` ("prompt 2 của Mai") is read after the words so the buttons of a page tell apart.
 */
export function TeachingButton({ id, event, context, onOpen }: { id: number; event: Pick<TrainingEventRow, 'exampleDraft' | 'teachingExample'>; context: string; onOpen: (id: number) => void }) {
  const reduced = useReducedMotion();
  const view = exampleButtonView(event, reduced);
  const look = LOOKS[view.kind];
  return (
    <button type="button" data-teaching={id} data-teaching-state={STATE_ATTR[view.kind]} aria-haspopup="dialog" onClick={() => onOpen(id)}
      aria-label={exampleButtonName(view, context, event.exampleDraft?.error ?? null)} title={view.title}
      style={{ ...base, border: look.border, background: look.bg, color: look.fg }}>
      {(view.kind === 'unseen' || view.kind === 'unseenSuspect') && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-600)', flex: 'none' }} />}
      <Icon name={view.icon} size={14} spin={view.spin} />
      {view.text}
    </button>
  );
}

/** `data-teaching-state` keeps the S44 words for a saved example (`good`, `needs_work`, `plain`) and names the draft states. */
const STATE_ATTR: Record<ExampleButtonKind, string> = { new: 'plain', drafting: 'drafting', unseen: 'draft-unseen', unseenSuspect: 'draft-unseen-suspect', unsaved: 'draft-unsaved', failed: 'draft-failed', savedGood: 'good', savedNeedsWork: 'needs_work' };

/** The chip at the top of a member's timeline when they did not agree: why no prompt has the "Làm ví dụ" button. */
export function NoTeachingChip() {
  return (
    <span data-no-teaching title="Bạn này không đồng ý cho dùng làm ví dụ" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 'var(--radius-pill)', border: '1px dashed var(--ink-400)', color: 'var(--ink-700)', font: 'var(--type-label)', fontSize: 12 }}>
      <Icon name="lock" size={13} />Không dùng làm ví dụ
    </span>
  );
}
