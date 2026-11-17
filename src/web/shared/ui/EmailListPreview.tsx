import { useState } from 'react';
import type { EmailListParse } from '../../../shared/email-list.js';
import { Icon } from './Icon.js';
import { SegmentedControl } from './SegmentedControl.js';
import { filterRows, previewCounts, previewRows, type PreviewFilter, type PreviewRowKind } from './email-preview-rows.js';

const MARK: Record<PreviewRowKind, { icon: string; color: string; label: string }> = {
  invalid: { icon: 'circle-x', color: 'var(--wrong-600)', label: 'Lỗi' },
  duplicate: { icon: 'copy', color: 'var(--sun-ink)', label: 'Trùng' },
  'added-domain': { icon: 'plus', color: 'var(--brand-700)', label: 'Thêm domain' },
  ok: { icon: 'check', color: 'var(--correct-600)', label: 'Hợp lệ' },
};

/**
 * Live preview of a pasted list of emails (PRODUCT.md §7.22): what will be saved, what is merged, what is wrong, by line.
 * Pure display of `parse`; the owner parses the text (`parseEmailList`) so the same result drives saving.
 */
export function EmailListPreview({ parse, maxHeight = 320 }: { parse: EmailListParse; maxHeight?: number }) {
  const counts = previewCounts(parse);
  const [filter, setFilter] = useState<PreviewFilter>('need');
  const shown = filterRows(previewRows(parse), counts.need === 0 && filter === 'need' ? 'all' : filter);

  if (counts.all === 0) {
    return <div style={{ padding: 20, border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--text-meta)', font: 'var(--type-meta)', textAlign: 'center' }}>Xem trước sẽ hiện ở đây khi bạn dán danh sách email.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }} aria-live="polite">
        <strong style={{ font: 'var(--type-ui)', color: 'var(--text-title)' }}>{counts.valid} email hợp lệ</strong>
        {counts.duplicates > 0 && <span style={{ color: 'var(--sun-ink)', font: 'var(--type-meta)' }}>· {counts.duplicates} trùng</span>}
        {counts.invalid > 0 && <span style={{ color: 'var(--wrong-600)', font: 'var(--type-meta)' }}>· {counts.invalid} lỗi</span>}
      </div>
      <SegmentedControl size="sm" ariaLabel="Lọc dòng xem trước" value={filter} onChange={setFilter}
        items={[{ value: 'need', label: 'Cần xem', count: counts.need }, { value: 'ok', label: `Hợp lệ ${counts.valid}` }, { value: 'all', label: `Tất cả ${counts.all}` }]} />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight, overflowY: 'auto', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-md)' }}>
        {shown.map(r => {
          const m = MARK[r.kind];
          return (
            <li key={r.key} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-hairline)', font: 'var(--type-meta)' }}>
              <span className="pq-tabular" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{r.line}</span>
              <span style={{ minWidth: 0, display: 'grid' }}>
                <span style={{ fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere', color: 'var(--text-title)' }}>
                  {r.raw}{r.kind === 'added-domain' && <span style={{ color: 'var(--text-meta)' }}> → {r.email}</span>}
                </span>
                {r.note && <span style={{ color: m.color }}>{r.note}</span>}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: m.color, fontWeight: 600, whiteSpace: 'nowrap' }}><Icon name={m.icon} size={14} />{m.label}</span>
            </li>
          );
        })}
        {shown.length === 0 && <li style={{ padding: 12, color: 'var(--text-meta)', font: 'var(--type-meta)' }}>Không có dòng nào.</li>}
      </ul>
    </div>
  );
}
