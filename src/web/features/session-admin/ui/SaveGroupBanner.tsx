import { Button } from '../../../shared/ui/Button.js';
import { Icon } from '../../../shared/ui/Icon.js';

/** After a session that used a typed list: offer to keep it as a group. Putting it off hides this; the list is never deleted. */
export function SaveGroupBanner({ count, onSave, onLater }: { count: number; onSave: () => void; onLater: () => void }) {
  return (
    <div role="region" aria-label="Lưu danh sách thành nhóm" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--sun-100)', color: 'var(--sun-ink)', border: '1px solid var(--sun-300)' }}>
      <Icon name="bookmark-plus" size={18} />
      <span style={{ flex: '1 1 280px', minWidth: 0, font: 'var(--type-ui)' }}><b>Danh sách {count} email này chưa được lưu thành nhóm.</b> Lưu lại để dùng cho các phiên sau, khỏi dán lại.</span>
      <Button size="sm" variant="ghost" onClick={onLater}>Để sau</Button>
      <Button size="sm" icon="bookmark-plus" onClick={onSave}>Lưu thành nhóm</Button>
    </div>
  );
}
