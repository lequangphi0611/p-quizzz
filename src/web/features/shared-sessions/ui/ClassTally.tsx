import { Markdown } from '../../../shared/ui/Markdown.js';
import { Icon } from '../../../shared/ui/Icon.js';
import type { Tally } from '../domain/shared-view.js';

// How the class chose on one question: one row per option with the share of submissions, the key marked by an icon
// and words (not colour alone). Aggregate only: never who chose what (PRODUCT.md §7.33d).
export function ClassTally({ tally }: { tally: Tally }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {tally.rows.map(r => (
          <li key={r.id} aria-label={`Phương án ${r.label}${r.isCorrect ? ', đáp án đúng' : ''}, ${r.count} người, ${r.pct}%`}
            style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr)', gap: 12, alignItems: 'start', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid ' + (r.isCorrect ? 'var(--correct-border)' : 'var(--border-hairline)'), background: r.isCorrect ? 'var(--correct-surface)' : 'var(--paper)' }}>
            <span aria-hidden="true" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-sm)', font: '700 14px/1 var(--font-mono)', background: r.isCorrect ? 'var(--correct-600)' : 'var(--ink-100)', color: r.isCorrect ? '#fff' : 'var(--ink-700)' }}>{r.label}</span>
            <span style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={{ minWidth: 0, flex: '1 1 240px', overflowWrap: 'anywhere', color: 'var(--text-body)' }}><Markdown inlineOnly source={r.text} /></span>
                {r.isCorrect && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: 'var(--type-label)', color: 'var(--correct-600)', whiteSpace: 'nowrap' }}><Icon name="circle-check" size={14} />Đáp án đúng</span>}
              </span>
              <span aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
                <span style={{ height: 8, borderRadius: 99, background: 'var(--ink-100)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${r.pct}%`, background: r.isCorrect ? 'var(--correct-500)' : 'var(--ink-400)', borderRadius: 99 }} />
                </span>
                <span className="pq-tabular" style={{ font: 'var(--type-meta)', color: 'var(--text-meta)', whiteSpace: 'nowrap' }}><b style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-title)' }}>{r.pct}%</b> · {r.count} người</span>
              </span>
            </span>
          </li>
        ))}
        <li aria-label={`Bỏ trống, ${tally.blank.count} người, ${tally.blank.pct}%`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
          <span>Bỏ trống</span><span className="pq-tabular" aria-hidden="true">{tally.blank.pct}% · {tally.blank.count} người</span>
        </li>
      </ul>
      <p style={{ margin: 0, font: 'var(--type-meta)', color: 'var(--text-faint)' }}>
        Tỉ lệ tính trên {tally.submitted} bài nộp.{tally.multi ? ' Mỗi người có thể chọn nhiều phương án nên tổng các dòng lớn hơn 100%.' : ''}
      </p>
    </div>
  );
}
