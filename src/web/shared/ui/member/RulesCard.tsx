import type { ReactNode } from 'react';
import type { MeResponse } from '../../../../shared/api/index.js';
import { formatMinutes } from '../../format/countdown.js';
import { formatPoints } from '../../format/points.js';
import { Card } from '../Card.js';
import { Icon } from '../Icon.js';
import { mText } from './member-shell.js';

/**
 * The rules of the attempt, shown in the lobby so members read them while they wait (PRODUCT.md §7.31d), and compact on
 * the late-arrival screen. Counts only: never a question.
 */
export function RulesCard({ session, phone = false, compact = false }: { session: MeResponse['session']; phone?: boolean; compact?: boolean }) {
  const limit = session.timer?.limitMinutes ?? null;
  const stat = (n: ReactNode, l: string) => (
    <span style={{ display: 'grid', gap: 2, padding: phone ? '10px 6px' : '12px 10px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
      <b style={{ font: `700 ${phone ? 20 : 22}px/1 var(--font-mono)`, color: 'var(--text-title)' }}>{n}</b><span style={mText.meta}>{l}</span>
    </span>
  );
  const rule = (icon: string, text: ReactNode) => <li key={icon} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Icon name={icon} size={16} style={{ marginTop: 3, flex: 'none' }} color="var(--ink-600)" /><span style={{ textWrap: 'pretty' }}>{text}</span></li>;
  return (
    <Card padding={phone ? 16 : 24}>
      <div style={{ display: 'grid', gap: 16 }}>
        <span style={{ margin: 0, font: '700 16px/1.35 var(--font-sans)', color: 'var(--text-title)' }}>Luật làm bài</span>
        {!compact && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${limit !== null ? 4 : 3},minmax(0,1fr))`, gap: 8 }}>
            {stat(session.questionCount, 'câu')}{stat(formatPoints(session.totalPoints), 'điểm')}{limit !== null && stat(limit, 'phút')}{stat(1, 'lượt')}
          </div>
        )}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10, font: 'var(--type-ui)', fontSize: 15, color: 'var(--text-body)' }}>
          {rule('lock', 'Mỗi người làm 1 lượt — nộp rồi không làm lại, không sửa được.')}
          {limit !== null && rule('hourglass', <>Giới hạn <b>{formatMinutes(limit)} chung cho cả phòng</b>, tính từ lúc phiên bắt đầu. Vào trễ thì còn ít thời gian hơn. Đồng hồ không dừng khi rớt mạng hay tải lại trang.</>)}
          {rule('save', 'Bài được lưu liên tục — tải lại trang hay rớt mạng cũng không mất.')}
          {!compact && rule('eye-off', 'Đáp án và điểm từng câu hiện sau khi mentor đóng phiên.')}
          {!compact && session.hasEssay && rule('pencil', 'Có câu tự luận — mentor chấm sau; điểm tạm tính chưa gồm phần này.')}
        </ul>
        {!compact && (
          <p style={{ ...mText.meta, display: 'flex', gap: 8, margin: 0, padding: '10px 12px', border: '1px dashed var(--ink-300)', borderRadius: 'var(--radius-md)' }}>
            <Icon name="info" size={15} style={{ marginTop: 2, flex: 'none' }} /><span>Câu hỏi chỉ hiện khi phiên bắt đầu. Lúc đó bạn vào thẳng câu 1, không cần bấm thêm.</span>
          </p>
        )}
      </div>
    </Card>
  );
}
