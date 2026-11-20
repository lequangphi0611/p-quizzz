import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Icon } from '../../../shared/ui/Icon.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { mText, useIsDesk } from '../../../shared/ui/member/member-shell.js';
import { useSharedList } from '../application/use-shared.js';
import { clockOf, dayMonth, longDate, monthGroups, rowLabel, sessionPath } from '../domain/shared-view.js';
import { ConnectionError, InvalidLink, SharedFrame, StateCard } from './SharedFrame.js';

// "/shared/:token": the sessions the mentor shares (PRODUCT.md §7.33c). Anyone with the link; nothing about any person.
export function SharedListPage() {
  const { token = '' } = useParams();
  const desk = useIsDesk();
  const { state } = useLocation() as { state: { focusSession?: number } | null };
  const { load, retry, retrying } = useSharedList(token);

  // Back from a session opened directly: bring its row into view and focus it.
  useEffect(() => {
    if (load.state !== 'ready' || !state?.focusSession) return;
    const el = document.querySelector<HTMLElement>(`[data-session-row="${state.focusSession}"]`);
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
  }, [load.state, state?.focusSession]);

  if (load.state === 'failed' && load.failure !== 'network') return <SharedFrame desk={desk}><InvalidLink /></SharedFrame>;

  const head = (
    <div style={{ display: 'grid', gap: 8 }}>
      <h1 tabIndex={-1} data-pq-focus="" style={{ ...mText.h1, fontSize: desk ? 30 : 24, outline: 'none' }}>Phiên đã thi được chia sẻ</h1>
      <p style={{ ...mText.meta, fontSize: desk ? 16 : 15, maxWidth: 640 }}>Mentor mở lại đề, đáp án và lời giải của các phiên này để bạn ôn đúng phần lớp đã làm. Bạn chỉ xem, không làm bài và không có điểm.</p>
    </div>
  );

  let body;
  if (load.state === 'loading') body = <Spinner block label="Đang tải danh sách phiên…" />;
  else if (load.state === 'failed') body = <ConnectionError what="danh sách phiên" onRetry={retry} retrying={retrying} />;
  else if (load.data.sessions.length === 0) body = <StateCard icon="library" title="Chưa có phiên nào được chia sẻ" text="Khi mentor chia sẻ một phiên đã thi, phiên đó sẽ hiện ở đây. Bạn có thể hỏi mentor phiên nào đang được mở để ôn." />;
  else {
    body = (
      <div style={{ display: 'grid', gap: 20 }}>
        {monthGroups(load.data.sessions).map(g => (
          <section key={g.key} aria-label={g.label} style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <h2 style={{ margin: 0, ...mText.label }}>{g.label}</h2>
              <span style={{ font: 'var(--type-meta)', color: 'var(--text-faint)' }}>{g.items.length} phiên</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 4, background: 'var(--paper)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', display: 'grid', gap: 2 }}>
              {g.items.map(it => (
                <li key={it.id}>
                  <Link to={sessionPath(token, it.id)} state={{ fromList: true }} data-session-row={it.id} aria-label={rowLabel(it)} className="pq-share-row"
                    style={{ display: 'grid', gridTemplateColumns: desk ? '76px minmax(0,1fr) 24px' : '64px minmax(0,1fr) 20px', gap: desk ? 16 : 12, alignItems: 'center', minHeight: 72, padding: desk ? '10px 14px 10px 10px' : '8px 10px 8px 8px', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit' }}>
                    <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', alignContent: 'center', gap: 4, height: 56, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--ink-200)' }}>
                      {it.startedAt === null ? <span style={{ font: '700 16px/1 var(--font-mono)', color: 'var(--text-meta)' }}>—</span> : <>
                        <span style={{ font: `700 ${desk ? 18 : 16}px/1 var(--font-mono)`, color: 'var(--text-title)' }}>{dayMonth(it.startedAt)}</span>
                        <span style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--text-meta)' }}>{clockOf(it.startedAt)}</span>
                      </>}
                    </span>
                    <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                      <span style={{ font: `600 ${desk ? 16 : 15}px/1.35 var(--font-sans)`, color: 'var(--text-title)', overflowWrap: 'anywhere', textWrap: 'pretty' }}>{it.examTitle}</span>
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
                        {it.startedAt !== null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="calendar" size={14} />{longDate(it.startedAt)}</span>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="list" size={14} />{it.questionCount} câu</span>
                      </span>
                    </span>
                    <Icon name="chevron-right" size={18} style={{ color: 'var(--ink-500)', justifySelf: 'end' }} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p style={{ ...mText.meta, display: 'flex', gap: 8, alignItems: 'flex-start' }}><Icon name="shield-alert" size={16} style={{ marginTop: 1 }} /><span>Trang này không có tên, điểm hay bài làm của ai — chỉ có đề, lời giải và số liệu chung của cả lớp.</span></p>
      </div>
    );
  }
  return <SharedFrame desk={desk}>{head}{body}</SharedFrame>;
}
