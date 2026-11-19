import { useEffect, useRef, type CSSProperties } from 'react';
import type { DiscussionQuestion } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Markdown } from '../../../shared/ui/Markdown.js';
import { optionLetter } from '../domain/discussion-ui.js';
import type { ReasonBoard, ReasonGroup } from '../domain/reason-groups.js';
import { QHeader } from './parts.js';
import { st } from './styles.js';

// "Lý do của lớp" (S30, PRODUCT.md §7.32e; design: docs/stories/S30-choice-reason.md). Replaces the question view while
// open: the prompt shrinks to 4 lines, each pick is a group with its anonymous reasons. No names, no numbering.

const badge = (multi: boolean, size: number, win: boolean, dim = false): CSSProperties => ({
  width: size, height: size, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: multi ? 'var(--radius-sm)' : '50%', boxSizing: 'border-box',
  background: win ? 'var(--screen-correct)' : dim ? 'transparent' : 'var(--screen-panel-hover)',
  border: '2px solid ' + (win ? 'var(--screen-correct)' : dim ? 'var(--screen-line)' : 'var(--screen-line-strong)'),
  color: win ? 'var(--ink-900)' : dim ? 'var(--screen-meta)' : 'var(--screen-text)', font: `700 ${Math.round(size * 0.46)}px/1 var(--font-mono)`,
});
const plain = (md: string) => md.replace(/`/g, '').replace(/\*\*/g, '');

function Letters({ g, multi, size, win }: { g: ReasonGroup; multi: boolean; size: number; win: boolean }) {
  return (
    <>
      {g.letters.map((L, i) => (
        <span key={L} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden="true" style={{ font: `600 ${size > 50 ? 30 : 26}px/1 var(--font-sans)`, color: 'var(--screen-meta)' }}>+</span>}
          <span aria-hidden="true" style={badge(multi, size, win)}>{L}</span>
        </span>
      ))}
    </>
  );
}

const CorrectPill = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--screen-correct)', color: 'var(--ink-900)', font: '700 22px/1 var(--font-sans)', whiteSpace: 'nowrap', ...st.reveal }}>
    <Icon name="circle-check" size={22} />Đáp án đúng
  </span>
);

function Group({ g, multi, revealed, collapsed, onToggle }: { g: ReasonGroup; multi: boolean; revealed: boolean; collapsed: boolean; onToggle: () => void }) {
  const win = revealed && g.correct;
  const label = g.letters.join(' + ');
  const title = g.reasons.length ? `${g.reasons.length} lý do` : 'Chưa có lý do';
  const aria = `${multi ? 'Tổ hợp' : 'Phương án'} ${label}: ${g.people} người chọn, ${g.reasons.length} lý do${win ? ', đáp án đúng' : ''}`;

  if (g.people === 0) {
    return (
      <div role="group" aria-label={`Phương án ${label}: không ai chọn`} style={{ flex: 'none', display: 'grid', gridTemplateColumns: '400px minmax(0,1fr) auto', gap: 20, alignItems: 'center', padding: '12px 22px', border: '2px dashed var(--screen-line)', borderRadius: 'var(--radius-lg)', color: 'var(--screen-meta)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}><span aria-hidden="true" style={badge(multi, 44, false, true)}>{g.letters[0]}</span><span style={{ font: '600 28px/1 var(--font-sans)' }}>Không ai chọn</span></span>
        <span style={{ font: '500 24px/1.3 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{plain(g.optionTexts[0] ?? '')}</span>
        <span style={{ font: '500 24px/1 var(--font-mono)' }}>0 người</span>
      </div>
    );
  }

  const surface = { background: win ? 'var(--screen-correct-surface)' : undefined, border: '2px solid ' + (win ? 'var(--screen-correct-border)' : 'var(--screen-line)'), borderRadius: 'var(--radius-lg)', transition: 'background var(--dur-slow) var(--ease-standard), border-color var(--dur-slow) var(--ease-standard)' };
  if (collapsed) {
    return (
      <div role="group" aria-label={aria} style={{ ...surface, background: win ? 'var(--screen-correct-surface)' : 'var(--screen-panel)', flex: 'none', display: 'grid', gridTemplateColumns: '400px minmax(0,1fr) auto', gap: 20, alignItems: 'center', padding: '10px 14px 10px 22px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Letters g={g} multi={multi} size={44} win={win} /><span style={{ marginLeft: 8, font: '700 30px/1 var(--font-sans)' }}>{title}</span></span>
        <span style={{ font: '500 24px/1.3 var(--font-sans)', color: 'var(--screen-meta)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{g.people} người chọn{!multi && g.optionTexts[0] ? ` · ${plain(g.optionTexts[0])}` : ''}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{win && <CorrectPill />}<Button tone="screen" variant="ghost" size="xl" icon="chevron-down" onClick={onToggle}>Mở nhóm</Button></span>
      </div>
    );
  }

  return (
    <div role="group" aria-label={aria} style={{ flex: 'none', display: 'grid', gridTemplateColumns: '400px minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ ...surface, borderColor: win ? 'var(--screen-correct-border)' : 'var(--screen-line-strong)', position: 'sticky', top: 0, display: 'grid', gap: 14, padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><Letters g={g} multi={multi} size={56} win={win} /><span style={{ marginLeft: 8, font: '700 34px/1.1 var(--font-sans)', letterSpacing: '-0.01em' }}>{title}</span></div>
        {multi
          ? <div style={{ display: 'grid', gap: 6 }}>{g.optionTexts.map((t, i) => <div key={i} style={{ font: '500 24px/1.3 var(--font-sans)', color: '#DDE1E7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{g.letters[i]}</b>  {plain(t)}</div>)}</div>
          : <div style={{ font: '500 24px/1.35 var(--font-sans)', color: '#DDE1E7', textWrap: 'pretty', overflowWrap: 'anywhere' }}><Markdown inlineOnly size="screen" source={g.optionTexts[0] ?? ''} /></div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><span style={{ font: '500 24px/1.2 var(--font-sans)', color: 'var(--screen-meta)' }}>{g.people} người chọn</span>{win && <CorrectPill />}</div>
        <div><Button tone="screen" variant="ghost" size="xl" icon="minus" onClick={onToggle}>Thu gọn</Button></div>
      </div>
      <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
        {g.reasons.length > 0 && (
          <div role="list" style={{ columns: 2, columnGap: 14 }}>
            {g.reasons.map((text, i) => (
              <div key={i} role="listitem" style={{ breakInside: 'avoid', margin: '0 0 14px', padding: '16px 20px', background: 'var(--screen-panel)', border: '2px solid var(--screen-line)', borderRadius: 'var(--radius-md)', font: '500 28px/1.4 var(--font-sans)', color: '#fff', overflowWrap: 'anywhere', textWrap: 'pretty', animation: `pq-reveal var(--dur-slow) var(--ease-standard) calc(var(--dur-fast) * ${(Math.min(i, 12) * 0.3).toFixed(1)}) both` }}>
                {/* Member-written text: shown as typed (like essays in PaperView), never parsed as Markdown. */}
                <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
              </div>
            ))}
          </div>
        )}
        {g.noReason > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', border: '2px dashed var(--screen-line-strong)', borderRadius: 'var(--radius-md)', font: '500 26px/1.3 var(--font-sans)', color: 'var(--screen-meta)' }}>
            <Icon name="info" size={26} /><span><b style={{ fontFamily: 'var(--font-mono)', color: 'var(--screen-text)' }}>{g.noReason}</b> người chọn nhưng chưa ghi lý do</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReasonsView({ q, index, board, revealed, collapsed, onToggleAnswer, onToggleReasons, onToggleGroup, onExpandAll }: {
  q: DiscussionQuestion; index: number; board: ReasonBoard; revealed: boolean; collapsed: ReadonlySet<string>;
  onToggleAnswer: () => void; onToggleReasons: () => void; onToggleGroup: (key: string) => void; onExpandAll: () => void;
}) {
  const multi = q.type === 'multi';
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headRef.current?.focus({ preventScroll: true }); }, []); // after R the focus lands on the block title
  const picked = board.groups.filter(g => g.people > 0);
  const anyCollapsed = picked.some(g => collapsed.has(g.key));

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 20, ...st.reveal }}>
      <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 48, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <QHeader q={q} index={index} />
          <p style={{ margin: 0, font: '600 30px/1.3 var(--font-sans)', color: 'var(--screen-text)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}><Markdown inlineOnly size="screen" source={q.prompt} /></p>
        </div>
        <div>
          {revealed
            ? <div style={{ ...st.panel, ...st.reveal, padding: '18px 24px', display: 'grid', gap: 10, maxHeight: 240, overflow: 'auto' }} className="pq-scroll"><span style={st.panelLabel}><Icon name="key-round" size={24} />Giải thích</span>{q.explanation ? <Markdown size="screen" source={q.explanation} /> : <span style={{ ...st.body28, color: 'var(--screen-meta)' }}>Đề không có giải thích cho câu này.</span>}</div>
            : (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px', border: '2px dashed var(--screen-line-strong)', borderRadius: 'var(--radius-lg)', color: 'var(--screen-meta)', font: '500 26px/1.3 var(--font-sans)' }}><Icon name="eye-off" size={28} />Đáp án và giải thích đang ẩn</div>
                {multi && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {q.options.map((o, i) => (
                      <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 14, alignItems: 'center', font: '500 24px/1.3 var(--font-sans)', color: '#DDE1E7' }}>
                        <span aria-hidden="true" style={{ ...badge(true, 40, false), font: '700 20px/1 var(--font-mono)' }}>{optionLetter(i)}</span>
                        <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plain(o.text)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 18, paddingTop: 4 }}>
        <Icon name="message-square" size={34} style={{ color: 'var(--sun-400)' }} />
        <h2 ref={headRef} tabIndex={-1} style={{ margin: 0, font: '700 34px/1 var(--font-sans)', letterSpacing: '-0.01em', outline: 'none' }}>Lý do của lớp</h2>
        <span style={{ font: '500 24px/1.2 var(--font-sans)', color: 'var(--screen-meta)' }}><b style={{ font: '700 26px/1 var(--font-mono)', color: 'var(--screen-text)' }}>{board.total}</b> lý do · không tên · thứ tự đã trộn</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {anyCollapsed && <Button tone="screen" variant="ghost" size="xl" icon="chevron-down" onClick={onExpandAll}>Mở tất cả nhóm</Button>}
          {revealed
            ? <Button tone="screen" variant="secondary" size="xl" icon="eye-off" shortcut="Space" onClick={onToggleAnswer}>Ẩn đáp án</Button>
            : <Button tone="screen" variant="primary" size="xl" icon="key-round" shortcut="Space" onClick={onToggleAnswer}>Hiện đáp án</Button>}
          <Button tone="screen" variant="ghost" size="xl" icon="eye-off" shortcut="R" onClick={onToggleReasons} style={{ border: '2px solid var(--screen-line-strong)' }}>Ẩn lý do</Button>
        </span>
      </div>

      {board.total === 0 ? (
        <div style={{ flex: 1, minHeight: 0, border: '2px dashed var(--screen-line-strong)', borderRadius: 'var(--radius-lg)', display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 20, textAlign: 'center', padding: 32 }}>
          <span style={{ width: 104, height: 104, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--screen-panel)', border: '2px solid var(--screen-line)', color: 'var(--screen-meta)' }}><Icon name="message-square" size={48} /></span>
          <span style={{ font: '700 40px/1.2 var(--font-sans)' }}>Chưa có lý do nào cho câu này</span>
          <span style={{ font: '400 28px/1.45 var(--font-sans)', color: 'var(--screen-meta)', maxWidth: 1100 }}>Không bài nào ghi lý do — học viên bỏ trống câu hoặc bài được nộp tự động khi hết giờ. Phân bố lựa chọn vẫn xem được khi ẩn lý do.</span>
        </div>
      ) : (
        <div className="pq-scroll" tabIndex={0} aria-label="Lý do của lớp, nhóm theo lựa chọn" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 10, marginRight: -10 }}>
          {board.groups.map(g => <Group key={g.key} g={g} multi={multi} revealed={revealed} collapsed={collapsed.has(g.key)} onToggle={() => onToggleGroup(g.key)} />)}
          <div style={{ flex: 'none', padding: '6px 0 4px', font: '400 22px/1.3 var(--font-sans)', color: 'var(--screen-meta)' }}>
            {picked.length} {multi ? 'tổ hợp có người chọn' : 'phương án có người chọn'} · {q.blankCount} bài bỏ trống câu này{multi ? ' · nhóm theo đúng tổ hợp đã chọn' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
