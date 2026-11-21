import { useLoaderData, useNavigate } from 'react-router';
import { TRAINING_NAME_MAX, type TrainingSummary } from '../../../../shared/api/index.js';
import { formatDate } from '../../../shared/format/date.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { td, th } from '../../../shared/ui/tableStyles.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { useTrainingList } from '../application/use-training.js';
import { memberCountLabel } from '../domain/training-ui.js';
import { TrainingStatusBadge } from './chips.js';

// "/admin/trainings": every AI training (PRODUCT.md §7.34) and the form that opens a new one with just a name.
export function TrainingListPage() {
  const initial = useLoaderData() as TrainingSummary[];
  const { state, ctrl } = useTrainingList(initial);
  const nav = useNavigate();
  const { items, name, creating, createError, loading, loadError } = state;

  async function create() {
    const made = await ctrl.create();
    if (made) nav(`/admin/trainings/${made.id}`);
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>Buổi training AI</h1>

      <Card title="Tạo buổi mới" subtitle="Học viên vào bằng mã phòng, đồng ý rồi mới gửi prompt và lệnh của Claude Code về máy này.">
        <form onSubmit={e => { e.preventDefault(); void create(); }} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', maxWidth: 520 }}>
            <TextField label="Tên buổi" value={name} onChange={v => ctrl.setName(v)} placeholder="Ví dụ: Claude Code buổi 2, viết test" maxLength={TRAINING_NAME_MAX} error={createError} disabled={creating} />
          </div>
          <div style={{ paddingTop: 25 }}>
            <Button type="submit" icon="plus" size="lg" loading={creating}>Tạo buổi</Button>
          </div>
        </form>
      </Card>

      {loadError && <ErrorMessage title="Không tải lại được danh sách" message={loadError} onRetry={() => void ctrl.reload()} />}

      {items.length === 0 ? (
        <Card>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'start', font: 'var(--type-body)', color: 'var(--text-meta)' }}>
            <Icon name="code" size={24} />
            <strong style={{ color: 'var(--text-title)' }}>Chưa có buổi training nào</strong>
            <span>Tạo buổi ở trên. Mã phòng hiện ngay để bạn chiếu cho lớp; học viên đồng ý thì mới thấy họ ở đây.</span>
          </div>
        </Card>
      ) : (
        <Card padding={0} title="Các buổi" style={{ paddingTop: 16 }} actions={loading ? <Spinner label="Đang tải…" /> : <Button variant="ghost" size="sm" icon="refresh-cw" onClick={() => void ctrl.reload()}>Tải lại</Button>}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead><tr><th style={th}>Buổi</th><th style={th}>Trạng thái</th><th style={th}>Tạo lúc</th><th style={{ ...th, textAlign: 'right' }}>Số người</th><th style={th} /></tr></thead>
              <tbody>
                {items.map(t => (
                  <tr key={t.id} onClick={() => nav(`/admin/trainings/${t.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ ...td, whiteSpace: 'normal', fontWeight: 600, color: 'var(--text-title)' }}>
                      <a href={`/admin/trainings/${t.id}`} onClick={e => { e.preventDefault(); e.stopPropagation(); nav(`/admin/trainings/${t.id}`); }} style={{ color: 'inherit', textDecoration: 'none' }}>{t.name}</a>
                    </td>
                    <td style={td}><TrainingStatusBadge status={t.status} /></td>
                    <td style={{ ...td, color: 'var(--text-meta)' }}>{formatDate(t.createdAt)}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{memberCountLabel(t.memberCount)}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text-faint)' }}><Icon name="chevron-right" size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
