import { useCallback, useRef, useState } from 'react';
import { useLoaderData, useNavigate, type LoaderFunctionArgs } from 'react-router';
import type { SessionDetail as SessionDetailData, SessionParticipantInfo } from '../../shared/api/index.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { Icon } from '../components/ui/Icon.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { th, td } from '../components/ui/tableStyles.js';
import { api, ApiError } from '../lib/api.js';
import { ACTION_FOR_STATUS, formatProgressScore, PROGRESS_LABEL } from '../lib/session-ui.js';
import { useJoinHost } from '../lib/join-url.js';
import { formatRoomCode, joinLink } from '../lib/room-code.js';
import { useSessionEvents } from '../lib/useSessionEvents.js';

export const sessionDetailLoader = ({ params }: LoaderFunctionArgs) => api.get<SessionDetailData>(`/api/admin/sessions/${params.id}`);

const caption = { font: 'var(--type-label)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--brand-700)' } as const;
const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

// What the mentor hands out: the address, the room code, and a link that has the code built in.
function JoinCard({ status, roomCode }: { status: SessionDetailData['status']; roomCode: string | null }) {
  const { host, unreachable } = useJoinHost();
  const [copied, setCopied] = useState(false);
  const open = status === 'lobby' || status === 'running';
  const link = roomCode ? joinLink(host, roomCode) : '';

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* not available over plain http: the link is selectable */ }
  }
  const mono = (live: boolean) => ({ font: '700 26px/1.1 var(--font-mono)', color: live ? 'var(--text-title)' : 'var(--text-faint)', wordBreak: 'break-all' }) as const;

  return (
    <Card tone="brand">
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={caption}>Địa chỉ cho member</span>
        <span style={mono(open)}>{host}</span>
        <span style={{ ...caption, marginTop: 6 }}>Mã phòng</span>
        {roomCode ? (
          <span style={{ ...mono(open), fontSize: 34, letterSpacing: '0.12em' }}>{formatRoomCode(roomCode)}</span>
        ) : (
          <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Mã phòng sẽ có khi bạn mở phòng chờ.</span>
        )}
        {roomCode && open && (
          <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Hoặc gửi link — member bấm vào là vào luôn, khỏi gõ mã:</span>
            <code style={{ font: 'var(--type-code)', fontSize: 13, background: 'var(--paper)', border: '1px solid var(--brand-200)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', wordBreak: 'break-all', userSelect: 'all' }}>{link}</code>
            <div><Button size="sm" variant="secondary" icon={copied ? 'check' : 'copy'} onClick={copy}>{copied ? 'Đã sao chép' : 'Sao chép link'}</Button></div>
          </div>
        )}
        {roomCode && !open && <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Mã này đã hết hiệu lực vì phiên đã đóng.</span>}
        {unreachable && (
          <ErrorMessage tone="warning" message={<>Không tìm thấy địa chỉ mạng LAN của máy này. Kiểm tra máy đã kết nối Wi-Fi/mạng chưa — member không vào được bằng <b>localhost</b>.</>} />
        )}
      </div>
    </Card>
  );
}

function NameCell({ p, disabled, readOnly, onSave }: { p: SessionParticipantInfo; disabled: boolean; readOnly: boolean; onSave: (name: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(p.displayName);
  if (!editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--text-title)' }}>
        {p.displayName}
        {!readOnly && <button type="button" aria-label={`Đổi tên ${p.displayName}`} disabled={disabled} onClick={() => { setValue(p.displayName); setEditing(true); }} style={{ background: 'none', border: 0, padding: 2, cursor: disabled ? 'not-allowed' : 'pointer', color: 'var(--text-faint)' }}>
          <Icon name="pencil" size={14} />
        </button>}
      </span>
    );
  }
  const save = async () => { if (await onSave(value)) setEditing(false); };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        autoFocus value={value} maxLength={60} aria-label="Tên mới"
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ height: 32, width: 180, padding: '0 10px', font: 'var(--type-ui)', border: '1.5px solid var(--border-focus)', borderRadius: 'var(--radius-sm)' }}
      />
      <Button size="sm" onClick={save} disabled={disabled || !value.trim()}>Lưu</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Huỷ</Button>
    </span>
  );
}

type Dialog = { kind: 'action' } | { kind: 'kick'; p: SessionParticipantInfo } | null;

function SessionDetailView({ initial }: { initial: SessionDetailData }) {
  const nav = useNavigate();
  const [detail, setDetail] = useState(initial);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const seq = useRef(0); // drops a fetch that finished after a newer one (or after an action's own response)

  const refetch = useCallback(async () => {
    const n = ++seq.current;
    try {
      const d = await api.get<SessionDetailData>(`/api/admin/sessions/${initial.id}`);
      if (n === seq.current) setDetail(d);
    } catch { /* transient (e.g. server restarting); the next event or action refreshes */ }
  }, [initial.id]);

  useSessionEvents(initial.id, { session: refetch, participants: refetch });

  const spec = ACTION_FOR_STATUS[detail.status];
  const active = detail.participants.filter(p => p.status === 'active');
  const pending = detail.participants.filter(p => p.status === 'pending');
  const showProgress = detail.status !== 'draft' && detail.status !== 'lobby';
  const finalized = detail.status === 'finalized'; // results are official: no more renaming or kicking

  async function run(call: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setWorking(true);
    setError('');
    try {
      await call();
      return true;
    } catch (err) {
      setError(errorText(err, fallback));
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function doAction() {
    if (!spec) return;
    await run(async () => {
      const d = await api.post<SessionDetailData>(`/api/admin/sessions/${detail.id}/${spec.action}`);
      seq.current++;
      setDetail(d);
    }, `Không thể ${spec.label.toLowerCase()}`);
    setDialog(null); // on failure the message shows on the page behind the dialog
  }

  const participantAction = (path: string, fallback: string) => run(async () => { await api.post(path); await refetch(); }, fallback);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <button onClick={() => nav('/admin/sessions')} style={{ justifySelf: 'start', display: 'inline-flex', gap: 6, alignItems: 'center', background: 'none', border: 0, padding: 0, color: 'var(--text-meta)', font: 'var(--type-meta)', cursor: 'pointer' }}>
        <Icon name="arrow-left" size={14} />Phiên thi
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>{detail.exam.title}</h1>
        <StatusBadge status={detail.status} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" icon="presentation" onClick={() => window.open('/screen', '_blank')}>Mở màn hình chiếu</Button>
          {detail.status === 'closed' && detail.exam.hasEssay && (
            <Button variant="secondary" icon="pencil" onClick={() => nav(`/admin/sessions/${detail.id}/grading`)}>Chấm tự luận</Button>
          )}
          {spec && (
            <Button icon={spec.icon} variant={spec.variant} loading={working && !dialog} onClick={() => (spec.confirm ? setDialog({ kind: 'action' }) : void doAction())}>
              {spec.label}
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <Card padding={0} style={{ flex: '1 1 520px', minWidth: 0, overflowX: 'auto' }}>
          <div style={{ padding: '16px 16px 6px', font: 'var(--type-h2)', fontSize: 16, color: 'var(--text-title)' }}>Người tham gia · {active.length}</div>
          {active.length === 0 ? (
            <p style={{ margin: 0, padding: '8px 16px 20px', font: 'var(--type-meta)', color: 'var(--text-meta)' }}>
              {detail.status === 'draft' ? 'Mở phòng chờ để member bắt đầu vào.' : 'Chưa có ai vào phiên.'}
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Tên</th>{showProgress && <><th style={th}>Tiến độ</th><th style={th}>Điểm tạm tính</th></>}<th style={th} /></tr></thead>
              <tbody>
                {active.map(p => (
                  <tr key={p.id}>
                    <td style={td}>
                      <NameCell p={p} disabled={working} readOnly={finalized} onSave={name => run(async () => { await api.patch(`/api/admin/participants/${p.id}`, { displayName: name }); await refetch(); }, 'Không đổi được tên')} />
                    </td>
                    {showProgress && <>
                      <td style={{ ...td, color: PROGRESS_LABEL[p.progress.state].color }}>{PROGRESS_LABEL[p.progress.state].label}</td>
                      <td className="pq-tabular" style={{ ...td, fontFamily: 'var(--font-mono)' }}>{formatProgressScore(p.progress)}</td>
                    </>}
                    <td style={{ ...td, textAlign: 'right' }}>
                      {!finalized && <Button size="sm" variant="ghost" icon="user-x" disabled={working} onClick={() => setDialog({ kind: 'kick', p })}>Kick</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div style={{ display: 'grid', gap: 20, flex: '1 1 300px', maxWidth: 420 }}>
          <JoinCard status={detail.status} roomCode={detail.roomCode} />
          {pending.length > 0 && (
            <Card title={`Chờ duyệt · ${pending.length}`} subtitle="Vào trễ khi phiên đang chạy">
              <div style={{ display: 'grid', gap: 8 }}>
                {pending.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: 'var(--type-ui)', fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{p.displayName}</span>
                    <Button size="sm" icon="user-check" disabled={working} onClick={() => void participantAction(`/api/admin/participants/${p.id}/approve`, 'Không duyệt được')}>Duyệt</Button>
                    <Button size="sm" variant="ghost" icon="user-x" disabled={working} onClick={() => setDialog({ kind: 'kick', p })}>Từ chối</Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={dialog?.kind === 'action' && !!spec?.confirm}
        tone={spec?.variant ?? 'primary'}
        title={spec?.confirm?.title ?? ''}
        confirmLabel={spec?.confirm?.confirmLabel}
        busy={working}
        onCancel={() => setDialog(null)}
        onConfirm={doAction}
      >
        {spec?.confirm?.body(active.length)}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'kick'}
        tone="danger"
        title={dialog?.kind === 'kick' ? `Kick ${dialog.p.displayName}?` : ''}
        confirmLabel="Kick"
        busy={working}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== 'kick') return;
          await participantAction(`/api/admin/participants/${dialog.p.id}/kick`, 'Không kick được');
          setDialog(null);
        }}
      >
        Người này sẽ bị loại khỏi phiên và không xuất hiện trên bảng xếp hạng.
      </ConfirmDialog>
    </div>
  );
}

export function SessionDetail() {
  const initial = useLoaderData() as SessionDetailData;
  return <SessionDetailView key={initial.id} initial={initial} />;
}
