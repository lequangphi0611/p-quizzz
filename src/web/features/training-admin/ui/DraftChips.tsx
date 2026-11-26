import type { ExampleDraftCounts } from '../../../../shared/api/index.js';
import { useReducedMotion } from '../../../shared/hooks/useStartNotices.js';
import { Icon } from '../../../shared/ui/Icon.js';

const chip = { display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 7px', borderRadius: 999, border: '1px solid var(--ink-200)', background: 'var(--paper)', font: '700 11px/1 var(--font-mono)', color: 'var(--ink-700)', flex: 'none' } as const;

/**
 * The AI drafts of one member (S45), small chips after the name: writing, finished and not opened, failed. Only the numbers that are not 0.
 * Icon plus number, never colour alone; what they say aloud is the description of the member's name button (`speech`).
 */
export function DraftChips({ counts, memberId }: { counts: ExampleDraftCounts; memberId: number }) {
  const reduced = useReducedMotion();
  if (counts.drafting + counts.unseen + counts.failed === 0) return null;
  return (
    <span data-member-drafts={memberId} aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {counts.drafting > 0 && <span data-draft-chip="drafting" title={`${counts.drafting} nháp đang viết`} style={chip}><Icon name={reduced ? 'hourglass' : 'loader-circle'} spin={!reduced} size={12} />{counts.drafting}</span>}
      {counts.unseen > 0 && (
        <span data-draft-chip="unseen" title={`${counts.unseen} nháp chưa xem`} style={chip}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-600)' }} /><Icon name="sparkles" size={12} />{counts.unseen}
        </span>
      )}
      {counts.failed > 0 && <span data-draft-chip="failed" title={`${counts.failed} nháp lỗi`} style={{ ...chip, color: 'var(--wrong-600)', borderColor: 'var(--wrong-border)' }}><Icon name="circle-alert" size={12} />{counts.failed}</span>}
    </span>
  );
}
