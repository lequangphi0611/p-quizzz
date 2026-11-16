import { useLoaderData } from 'react-router';
import type { GroupSummary } from '../../../../shared/api/index.js';
import { formatDate } from '../../../shared/format/date.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js';
import { EmailListPreview } from '../../../shared/ui/EmailListPreview.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { saveNote } from '../../../shared/ui/email-preview-rows.js';
import { useGroups } from '../application/groups-context.js';
import { isDirty, parseDraft, saveBlocker } from '../domain/group-editor.js';

// "/admin/groups" — the mentor's saved lists of member emails. Paste a list, see what will be saved, save it once and
// reuse it for any number of sessions. Emails are shown only here and on the session page (PRODUCT.md §7.24).
export function GroupsPage() {
  const initial = useLoaderData() as GroupSummary[];
  const { state, ctrl } = useGroups(initial);
  const { groups, selected, draft, saved, saving, loading, error, notice, confirmDelete } = state;
  const parse = parseDraft(draft);
  const blocker = saveBlocker(draft, parse);
  const dirty = isDirty(draft, saved);
  const open = selected === 'new' ? null : groups.find(g => g.id === selected);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ font: 'var(--type-h1)', color: 'var(--text-title)', margin: 0 }}>Nhóm học viên</h1>
        <Button icon="plus" variant={selected === 'new' ? 'secondary' : 'primary'} onClick={() => ctrl.newGroup()}>Nhóm mới</Button>
      </div>
      <p style={{ margin: 0, font: 'var(--type-body)', color: 'var(--text-meta)', maxWidth: 720 }}>
        Mỗi nhóm là danh sách email của một lớp. Khi tạo phiên, chọn nhóm để chỉ những người trong danh sách mới vào được. Email chỉ mình bạn thấy.
      </p>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', alignItems: 'start' }}>
        <nav aria-label="Danh sách nhóm" style={{ display: 'grid', gap: 8 }}>
          {groups.length === 0 && <Card tone="sunken"><span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>Chưa có nhóm nào. Dán danh sách email ở bên phải để tạo nhóm đầu tiên.</span></Card>}
          {groups.map(g => {
            const on = g.id === selected;
            return (
              <button key={g.id} type="button" onClick={() => void ctrl.open(g.id)} aria-current={on ? 'true' : undefined}
                style={{ display: 'grid', gap: 2, textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: on ? '2px solid var(--ink-900)' : '1px solid var(--border-hairline)', background: on ? 'var(--ink-100)' : 'var(--surface-card)', font: 'var(--type-ui)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-title)', overflowWrap: 'anywhere' }}>{g.name}</span>
                <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{g.emailCount} email{g.lastUsedAt ? ` · dùng lần cuối ${formatDate(g.lastUsedAt)}` : ''}</span>
              </button>
            );
          })}
        </nav>

        <Card title={open ? `Sửa nhóm “${open.name}”` : 'Nhóm mới'} subtitle={loading ? 'Đang tải…' : undefined}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}>
              <TextField label="Tên nhóm" value={draft.name} onChange={v => ctrl.edit({ name: v })} placeholder="vd. #member-0908" maxLength={60} />
              <TextField label="Domain mặc định (tuỳ chọn)" value={draft.defaultDomain} onChange={v => ctrl.edit({ defaultDomain: v })} placeholder="gmail.com" spellCheck={false}
                hint="Dòng nào chưa có @ sẽ được thêm domain này." />
            </div>
            <TextField label="Danh sách email" multiline mono rows={9} value={draft.text} onChange={v => ctrl.edit({ text: v })} spellCheck={false}
              placeholder={'philq@gmail.com\nphiabc@gmail.com\nhoặc chỉ "philq" nếu đã điền domain mặc định'}
              hint="Mỗi dòng một email, hoặc cách nhau bằng dấu phẩy. Phân biệt chữ hoa/thường không quan trọng." />
            <EmailListPreview parse={parse} />
            {error && <ErrorMessage message={error} />}
            {notice && <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--correct-600)', font: 'var(--type-ui)' }}><Icon name="circle-check" size={16} />{notice}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Button icon="save" loading={saving} disabled={!!blocker || !dirty} onClick={() => void ctrl.save()}>
                Lưu nhóm{parse.valid.length > 0 ? ` · ${parse.valid.length} email` : ''}
              </Button>
              {selected === 'new'
                ? <Button variant="ghost" disabled={saving || !dirty} onClick={() => ctrl.newGroup()}>Huỷ</Button>
                : <Button variant="ghost" icon="trash-2" disabled={saving} onClick={() => ctrl.askDelete(true)}>Xoá nhóm</Button>}
              <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{saveNote(parse)}</span>
            </div>
            {blocker && dirty && <span style={{ font: 'var(--type-meta)', color: 'var(--text-meta)' }}>{blocker}.</span>}
          </div>
        </Card>
      </div>

      <ConfirmDialog open={confirmDelete} tone="danger" title={open ? `Xoá nhóm “${open.name}”?` : 'Xoá nhóm?'} confirmLabel="Xoá nhóm" busy={saving} onCancel={() => ctrl.askDelete(false)} onConfirm={() => ctrl.remove()}>
        Các phiên đã tạo từ nhóm này không bị ảnh hưởng: mỗi phiên giữ danh sách riêng của nó.
      </ConfirmDialog>
    </div>
  );
}

