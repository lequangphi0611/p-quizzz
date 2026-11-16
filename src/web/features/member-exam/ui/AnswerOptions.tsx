import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MemberQuestion } from '../../../../shared/api/index.js';
import { AnswerOption } from '../../../shared/ui/AnswerOption.js';
import { Kbd } from '../../../shared/ui/Kbd.js';

export function AnswerOptions({ q, selected, onPick, keys, dimKeys }: { q: MemberQuestion; selected: number[]; onPick: (id: number) => void; keys: boolean; dimKeys: boolean }) {
  // ↑ / ↓ move focus between options (← → stay reserved for changing question).
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };
  return (
    <div role={q.type === 'multi' ? 'group' : 'radiogroup'} aria-label="Phương án" onKeyDown={onKeyDown} style={{ display: 'grid', gap: 10 }}>
      {q.options.map((o, i) => (
        <div key={o.id} style={{ display: 'grid', gridTemplateColumns: keys ? '24px minmax(0,1fr)' : 'minmax(0,1fr)', gap: 12, alignItems: 'center' }}>
          {keys && <span aria-hidden="true" style={{ justifySelf: 'center' }}>{i < 9 && <Kbd active={selected.includes(o.id)} dim={dimKeys}>{i + 1}</Kbd>}</span>}
          <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}><AnswerOption kind={q.type === 'multi' ? 'multi' : 'single'} text={o.text} selected={selected.includes(o.id)} onClick={() => onPick(o.id)} /></div>
        </div>
      ))}
    </div>
  );
}
