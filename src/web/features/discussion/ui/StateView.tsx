import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Icon } from '../../../shared/ui/Icon.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { st } from './styles.js';

export function StateView({ kind, onRetry, onExit, message }: { kind: 'loading' | 'empty' | 'error'; onRetry: () => void; onExit: () => void; message?: string }) {
  const wrap = { height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center' } as const;
  if (kind === 'loading') return <div style={wrap}><div style={{ display: 'grid', gap: 28, justifyItems: 'center' }}><Spinner size={72} /><span style={{ font: '600 32px/1.3 var(--font-sans)', color: 'var(--screen-text)' }}>Đang tải bài làm…</span></div></div>;
  if (kind === 'empty') {
    return (
      <div style={wrap}><div style={{ display: 'grid', gap: 24, justifyItems: 'center', maxWidth: 1000 }}>
        <span style={{ width: 128, height: 128, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--screen-panel)', border: '2px solid var(--screen-line)', color: 'var(--screen-meta)' }}><Icon name="file-text" size={60} /></span>
        <h1 style={{ ...st.prompt, fontSize: 48 }}>Phiên này không có bài nào để thảo luận</h1>
        <p style={{ margin: 0, font: '400 28px/1.45 var(--font-sans)', color: 'var(--screen-meta)' }}>Không học viên nào nộp bài trước khi phiên đóng.</p>
        <Button tone="screen" variant="secondary" size="xl" icon="arrow-left" onClick={onExit}>Về trang phiên</Button>
      </div></div>
    );
  }
  return (
    <div style={wrap}><div style={{ display: 'grid', gap: 24, justifyItems: 'center', width: 920 }}>
      <span style={{ width: 128, height: 128, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--screen-wrong-surface)', border: '2px solid var(--screen-wrong-border)', color: 'var(--screen-wrong)' }}><Icon name="cloud-off" size={60} /></span>
      <h1 style={{ ...st.prompt, fontSize: 48 }}>Không tải được dữ liệu thảo luận</h1>
      <div style={{ width: '100%', textAlign: 'left' }}><ErrorMessage size="screen" title={message ?? 'Mất kết nối tới máy chủ p-quizzz'} message="Kiểm tra máy mentor vẫn đang chạy app, rồi thử lại." /></div>
      <div style={{ display: 'flex', gap: 16 }}>
        <Button tone="screen" variant="ghost" size="xxl" icon="arrow-left" onClick={onExit}>Về trang phiên</Button>
        <Button tone="screen" size="xxl" icon="refresh-cw" onClick={onRetry}>Thử lại</Button>
      </div>
    </div></div>
  );
}
