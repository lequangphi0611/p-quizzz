import type { CSSProperties } from 'react';
import type { TrainingEventRow } from '../../../../shared/api/index.js';
import { Icon } from '../../../shared/ui/Icon.js';
import type { PanelKind, PanelState } from '../application/training-controller.js';
import { decisionText, noticeTitle, sessionTitle } from '../domain/row-text.js';
import { toolLabel } from '../domain/tool-label.js';
import { ToolName, visuallyHidden } from './chips.js';

const mono = 'var(--font-mono)';

/** The box every row shares: the open panel's row has the blue bar, the row a flag chip jumped to has a yellow one. */
export const rowBox = (active: boolean, focused: boolean): CSSProperties => ({
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  background: active ? 'var(--selected-bg)' : focused ? 'var(--sun-100)' : undefined,
  boxShadow: active ? 'inset 3px 0 0 var(--brand-600)' : focused ? 'inset 3px 0 0 var(--sun-ink)' : undefined,
});

/** Picks a row as an example for the report (or drops it). A bookmark with a tick when it is picked. */
export function MarkButton({ id, marked, onToggle }: { id: number; marked: boolean; onToggle: (id: number) => void }) {
  return (
    <button type="button" data-mark={id} aria-pressed={marked} title={marked ? 'Bỏ đánh dấu ví dụ' : 'Đánh dấu làm ví dụ cho báo cáo'} aria-label={marked ? 'Bỏ đánh dấu ví dụ' : 'Đánh dấu làm ví dụ cho báo cáo'} onClick={() => onToggle(id)}
      style={{ display: 'inline-grid', placeItems: 'center', width: 28, height: 28, padding: 0, border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', flex: 'none', background: marked ? 'var(--brand-050)' : 'transparent', color: marked ? 'var(--brand-700)' : 'var(--ink-500)' }}>
      <Icon name={marked ? 'bookmark-check' : 'bookmark-plus'} size={16} />
    </button>
  );
}

export function PanelButton({ id, kind, label, icon, on, onOpen }: { id: number; kind: PanelKind; label: string; icon: string; on: boolean; onOpen: (id: number, kind: PanelKind) => void }) {
  return (
    <button type="button" data-trigger={`${id}-${kind}`} aria-pressed={on} onClick={() => onOpen(id, kind)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 8px', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', font: 'var(--type-label)', fontSize: 13, color: on ? 'var(--brand-700)' : 'var(--text-link)', background: on ? 'var(--brand-050)' : 'transparent', textDecoration: on ? 'none' : 'underline' }}>
      <Icon name={icon} size={14} />{label}{on && <Icon name="check" size={12} />}
    </button>
  );
}

const TONE = {
  ok: { bg: 'var(--correct-surface)', fg: 'var(--correct-600)', bd: 'var(--correct-border)', icon: 'circle-check' },
  no: { bg: 'var(--ink-100)', fg: 'var(--ink-800)', bd: 'var(--ink-400)', icon: 'circle-x' },
  wait: { bg: 'var(--paper)', fg: 'var(--ink-700)', bd: 'var(--ink-400)', icon: 'hourglass' },
} as const;

/** Claude asked for permission. What the member answered is inferred from what ran next, and the words say so. */
export function PermissionRow({ event: e, panel, focused, onOpen, onMark }: { event: TrainingEventRow; panel: PanelState | null; focused: boolean; onOpen: (id: number, kind: PanelKind) => void; onMark: (id: number) => void }) {
  const d = decisionText(e);
  const t = TONE[d.tone];
  const active = panel?.eventId === e.id;
  return (
    <li id={`ev-${e.id}`} data-kind="permission" style={{ ...rowBox(active, focused), display: 'grid', gridTemplateColumns: '18px 64px minmax(0, 1fr) auto', columnGap: 10, rowGap: 6, alignItems: 'center' }}>
      <Icon name="lock" size={18} color="var(--ink-700)" />
      <ToolName name={toolLabel(e.toolName ?? '')} />
      <span title={e.toolTarget} style={{ minWidth: 0, font: `500 13.5px/1.45 ${mono}`, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={{ font: 'var(--type-label)', fontSize: 12, color: 'var(--text-meta)', marginRight: 8 }}>Claude xin quyền</span>{e.toolTarget}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px 2px 7px', borderRadius: 'var(--radius-pill)', background: t.bg, color: t.fg, border: `1px ${d.tone === 'wait' ? 'dashed' : 'solid'} ${t.bd}`, font: 'var(--type-label)', fontSize: 12, whiteSpace: 'nowrap' }}>
          <Icon name={t.icon} size={13} />{d.text}
        </span>
        <MarkButton id={e.id} marked={e.marked} onToggle={onMark} />
      </span>
      {e.hasChange && (
        <div style={{ gridColumn: '2 / -1', display: 'flex', gap: 4, marginLeft: -8 }}>
          <PanelButton id={e.id} kind="change" label="Xem thay đổi" icon="file-text" on={active && panel?.kind === 'change'} onOpen={onOpen} />
        </div>
      )}
    </li>
  );
}

/** `/clear`, `/exit`, `/compact` (typed or automatic) and `/model`: a marker line, not a command. */
export function SessionRow({ event: e, focused }: { event: TrainingEventRow; focused: boolean }) {
  const icon = e.subtype === 'clear' ? 'play' : e.subtype === 'exit' ? 'log-out' : e.subtype === 'model_switch' ? 'sparkles' : 'circle-dot';
  const note = e.note ? (e.subtype === 'model_switch' ? e.note : `“${e.note}”`) : null;
  return (
    <li id={`ev-${e.id}`} data-kind="session" data-subtype={e.subtype} style={{ ...rowBox(false, focused), display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px dashed var(--ink-300)', borderBottom: '1px dashed var(--ink-300)', borderRadius: 0, background: focused ? 'var(--sun-100)' : 'var(--surface-sunken)' }}>
      <Icon name={icon} size={16} color="var(--ink-700)" />
      <strong style={{ font: 'var(--type-ui)', fontSize: 13.5, color: 'var(--text-title)' }}>{sessionTitle(e.subtype)}</strong>
      {note && <span style={{ font: `500 13px/1.4 ${e.subtype === 'model_switch' ? mono : 'var(--font-sans)'}`, color: 'var(--ink-800)', overflowWrap: 'anywhere', minWidth: 0 }}>{note}</span>}
    </li>
  );
}

/** Claude Code is waiting for the member (to answer a permission prompt, or to type). Quiet: it is context, not a finding. */
export function NoticeRow({ event: e, focused }: { event: TrainingEventRow; focused: boolean }) {
  return (
    <li id={`ev-${e.id}`} data-kind="notice" style={{ ...rowBox(false, focused), display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-meta)', font: 'var(--type-meta)', fontSize: 13 }}>
      <Icon name="hourglass" size={16} />
      <span style={visuallyHidden}>Ghi chú: </span>{noticeTitle(e.subtype)}
    </li>
  );
}
