import type { ReactNode, Ref, UIEventHandler } from 'react';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { MemberLayout } from '../../../shared/ui/member/MemberLayout.js';
import { HeroIcon, mText } from '../../../shared/ui/member/member-shell.js';
import { Icon } from '../../../shared/ui/Icon.js';

// Frame and states shared by the two share pages. Light member theme, no name chip: the viewer is nobody in the session.

export const ViewOnlyChip = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--ink-100)', color: 'var(--ink-700)', border: '1px solid var(--ink-200)', font: 'var(--type-label)', whiteSpace: 'nowrap' }}>
    <Icon name="eye" size={14} />Chỉ xem lại
  </span>
);

export function SharedFrame({ desk, sidebar, mainRef, onMainScroll, children }: { desk: boolean; sidebar?: ReactNode; mainRef?: Ref<HTMLElement>; onMainScroll?: UIEventHandler<HTMLElement>; children: ReactNode }) {
  if (desk) {
    return (
      <MemberLayout variant="wide" sessionTitle="Xem lại phiên đã thi" headerEnd={<ViewOnlyChip />} sidebar={sidebar} mainRef={mainRef} onMainScroll={onMainScroll}>
        <div style={{ padding: '40px 32px 56px' }}><div style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gap: 24, minWidth: 0 }}>{children}</div></div>
      </MemberLayout>
    );
  }
  return <MemberLayout headerEnd={<ViewOnlyChip />}><div style={{ display: 'grid', gap: 20, minWidth: 0 }}>{children}</div></MemberLayout>;
}

/** A centred message card: empty list, invalid link, session no longer shared. */
export function StateCard({ icon, title, text, action, heading = 'h2' }: { icon: string; title: string; text: string; action?: ReactNode; heading?: 'h1' | 'h2' }) {
  const H = heading;
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 12, padding: '40px 24px', background: 'var(--paper)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', textAlign: 'center' }}>
      <HeroIcon name={icon} tone="ink" />
      <H tabIndex={-1} data-pq-focus="" style={{ margin: 0, font: heading === 'h1' ? 'var(--type-h1)' : 'var(--type-h2)', color: 'var(--text-title)', outline: 'none' }}>{title}</H>
      <p style={{ ...mText.meta, fontSize: 15, maxWidth: 440 }}>{text}</p>
      {action}
    </div>
  );
}

export const InvalidLink = () => <StateCard heading="h1" icon="circle-alert" title="Link này không mở được" text="Link có thể bị gõ sai hoặc không còn dùng nữa. Bạn hãy xin mentor link mới để xem các phiên được chia sẻ." />;

export const ConnectionError = ({ what, onRetry, retrying }: { what: string; onRetry: () => void; retrying: boolean }) => (
  <div style={{ display: 'grid', gap: 12 }}>
    <ErrorMessage title="Không kết nối được tới máy của mentor" message={`Có thể máy mentor đã tắt hoặc Wi-Fi bị rớt. Kiểm tra bạn vẫn dùng mạng của lớp rồi thử lại để tải ${what}.`} />
    <div><Button variant="secondary" icon="refresh-cw" loading={retrying} onClick={onRetry}>Thử lại</Button></div>
  </div>
);
