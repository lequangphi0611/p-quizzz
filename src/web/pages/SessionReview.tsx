import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import type { LeaderboardResponse, ParticipantReview, SessionDetail } from '../../shared/api/index.js';
import { LeaderboardView } from '../components/Leaderboard.js';
import { ReviewQuestions } from '../components/ReviewQuestions.js';
import { Card } from '../components/ui/Card.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Button } from '../components/ui/Button.js';
import { Icon } from '../components/ui/Icon.js';
import { Spinner } from '../components/ui/Spinner.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { th, td } from '../components/ui/tableStyles.js';
import { api, ApiError } from '../lib/api.js';
import { formatPoints } from '../shared/format/points.js';
import { formatDate } from '../lib/format.js';
import { PROGRESS_LABEL } from '../lib/session-ui.js';
import { defaultSelection, MEMBERSHIP_LABEL, summarize } from '../lib/session-review.js';

interface Data { session: SessionDetail; board: LeaderboardResponse }
export const sessionReviewLoader = async ({ params }: LoaderFunctionArgs): Promise<Data> => {
  const [session, board] = await Promise.all([
    api.get<SessionDetail>(`/api/admin/sessions/${params.id}`),
    api.get<LeaderboardResponse>(`/api/sessions/${params.id}/leaderboard`),
  ]);
  return { session, board };
};

const cell = { padding: '10px 12px', whiteSpace: 'normal' } as const; // compact: this table sits in a narrow column
const caption = { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--text-faint)' } as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <span style={caption}>{label}</span>
      <span className="pq-tabular" style={{ font: '700 24px/1.1 var(--font-mono)', color: 'var(--text-title)' }}>{value}</span>
    </div>
  );
}

// One person's attempt, loaded when selected.
function PersonDetail({ participantId }: { participantId: number }) {
  const [data, setData] = useState<ParticipantReview | null>(null);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    setData(null);
    setError('');
    api.get<ParticipantReview>(`/api/admin/participants/${participantId}/review`)
      .then(r => { if (n === seq.current) setData(r); })
      .catch(err => { if (n === seq.current) setError(err instanceof ApiError ? err.message : 'Không tải được bài làm'); });
  }, [participantId]);

  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Spinner block label="Đang tải bài làm…" />;

  const m = MEMBERSHIP_LABEL[data.participant.status];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-title)' }}>{data.participant.displayName}</h2>
          <span style={{ font: 'var(--type-label)', color: m.color }}>{m.label}</span>
          {data.attempt && (
            <span className="pq-tabular" style={{ marginLeft: 'auto', font: '700 28px/1 var(--font-mono)' }}>
              {formatPoints(data.attempt.score)}<span style={{ fontSize: 16, color: 'var(--text-faint)' }}>/{formatPoints(data.attempt.maxScore)}</span>
            </span>
          )}
        </div>
        {data.participant.status === 'kicked' && <p style={{ margin: '8px 0 0', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Người này bị loại khỏi phiên nên bài không được tính vào kết quả.</p>}
        {data.attempt && !data.attempt.official && <p style={{ margin: '8px 0 0', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Điểm tạm tính — tự luận chưa chấm xong hoặc chưa chốt kết quả.</p>}
      </Card>
      {!data.attempt ? (
        <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>
          {data.state === 'doing' ? 'Người này đang làm bài, chưa nộp.' : 'Người này không làm bài trong phiên.'}
        </p></Card>
      ) : (
        <ReviewQuestions review={data.attempt} viewer="mentor" />
      )}
    </div>
  );
}

export function SessionReview() {
  const { session, board } = useLoaderData() as Data;
  const nav = useNavigate();
  const stats = useMemo(() => summarize(session.participants), [session.participants]);
  const [selected, setSelected] = useState<number | null>(() => defaultSelection(session.participants));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <button onClick={() => nav(`/admin/sessions/${session.id}`)} style={{ justifySelf: 'start', display: 'inline-flex', gap: 6, alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'var(--text-meta)', font: 'var(--type-meta)', cursor: 'pointer' }}>
        <Icon name="arrow-left" size={14} />Phiên thi
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>Xem lại phiên</h1>
          <div style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
            {session.exam.title} · phiên #{session.id}{session.openedAt ? ` · mở ${formatDate(session.openedAt)}` : ''}{session.closedAt ? ` · đóng ${formatDate(session.closedAt)}` : ''}
          </div>
        </div>
        <StatusBadge status={session.status} />
        {(session.status === 'closed' || session.status === 'finalized') && (
          <span style={{ marginLeft: 'auto' }}><Button variant="secondary" icon="message-square" onClick={() => nav(`/admin/sessions/${session.id}/discuss`)}>Thảo luận</Button></span>
        )}
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          <Stat label="Người tham gia" value={String(stats.joined)} />
          <Stat label="Đã nộp bài" value={`${stats.submitted}/${stats.joined}`} />
          <Stat label="Điểm trung bình" value={stats.average === null ? '—' : `${formatPoints(Math.round(stats.average * 10) / 10)}/${session.exam.totalPoints}`} />
          {stats.total > stats.joined && <Stat label="Không được tính" value={String(stats.total - stats.joined)} />}
        </div>
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 20, flex: '1 1 480px', minWidth: 0 }}>
          <LeaderboardView entries={board.entries} provisional={board.provisional} />
          <Card padding={0} style={{ overflowX: 'auto' }}>
            <div style={{ padding: '16px 16px 6px', font: 'var(--type-h2)', fontSize: 16, color: 'var(--text-title)' }}>Ai đã tham gia · {session.participants.length}</div>
            {session.participants.length === 0 ? (
              <p style={{ margin: 0, padding: '8px 16px 20px', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Không có ai vào phiên này.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...th, ...cell }}>Tên</th><th style={{ ...th, ...cell }}>Tham gia</th><th style={{ ...th, ...cell }}>Bài làm</th><th style={{ ...th, ...cell }}>Điểm</th></tr></thead>
                <tbody>
                  {session.participants.map(p => {
                    const on = p.id === selected;
                    const m = MEMBERSHIP_LABEL[p.status];
                    const pr = PROGRESS_LABEL[p.progress.state];
                    return (
                      <tr key={p.id} tabIndex={0} aria-selected={on} onClick={() => setSelected(p.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(p.id); } }}
                        style={{ cursor: 'pointer', background: on ? 'var(--brand-050)' : 'transparent', boxShadow: on ? 'inset 3px 0 0 var(--brand-600)' : 'none' }}>
                        <td style={{ ...td, ...cell, fontWeight: 600, color: 'var(--text-title)', overflowWrap: 'anywhere' }}>{p.displayName}</td>
                        <td style={{ ...td, ...cell, color: m.color }}>{m.label}</td>
                        <td style={{ ...td, ...cell, color: pr.color }}>{pr.label}</td>
                        <td className="pq-tabular" style={{ ...td, ...cell, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{p.progress.countedScore === null ? '—' : `${formatPoints(p.progress.countedScore)}/${formatPoints(p.progress.maxScore)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div style={{ flex: '1.3 1 520px', minWidth: 0 }}>
          {selected === null ? (
            <Card><p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)' }}>Chọn một người để xem họ đã trả lời thế nào.</p></Card>
          ) : (
            <PersonDetail key={selected} participantId={selected} />
          )}
        </div>
      </div>
    </div>
  );
}
