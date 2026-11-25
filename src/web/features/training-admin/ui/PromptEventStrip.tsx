import { Icon } from '../../../shared/ui/Icon.js';
import { NewBadge } from './NewBadge.js';

/**
 * A command or permission request that arrived in a prompt the mentor had already read (S43): a strip under the prompt, light
 * brand tone with the "Lệnh mới" badge. `fading` = the 2 seconds are over: the badge fades and the strip goes back to white, but it
 * stays until the card leaves the view, so the card never changes height under the mentor's eyes.
 */
export function PromptEventStrip({ kind, text, result, at, fading = false }: { kind: 'command' | 'permission'; text: string; result: string; at: string; fading?: boolean }) {
  return (
    <div data-event-strip={kind} style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', margin: '8px 8px 0 0', padding: '6px 10px', borderRadius: 8,
      background: fading ? 'var(--paper)' : 'var(--brand-050)', border: `1px solid ${fading ? 'var(--ink-200)' : 'var(--brand-200)'}`,
      transition: 'background var(--dur-slow) var(--ease-standard), border-color var(--dur-slow) var(--ease-standard)',
    }}>
      <NewBadge label="Lệnh mới" fading={fading} />
      {kind === 'permission' && <Icon name="lock" size={13} color="var(--ink-700)" />}
      <span title={text} style={{ minWidth: 0, font: '500 13px/1.3 var(--font-mono)', color: 'var(--ink-900)', overflowWrap: 'anywhere' }}>{text}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '400 12px/1.4 var(--font-sans)', color: 'var(--ink-600)' }}>
        <Icon name={result.startsWith('lỗi') ? 'circle-x' : 'circle-check'} size={12} />{result} · {at}
      </span>
    </div>
  );
}
