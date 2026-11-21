import type { TrainingMemberRow } from '../../../../shared/api/index.js';

export type ConnectionKey = 'waiting' | 'connected' | 'uninstalled' | 'still-sending' | 'stopped-sending';

export interface ConnectionLabel {
  key: ConnectionKey;
  /** Vietnamese words for the state (never colour alone). */
  text: string;
  icon: string;
  /** Dashed = nothing heard yet; every other state has a solid border. */
  border: 'dashed' | 'solid';
  tone: 'neutral' | 'ok' | 'muted' | 'warn';
}

const LABELS: Record<ConnectionKey, ConnectionLabel> = {
  waiting: { key: 'waiting', text: 'Chưa nhận tín hiệu', icon: 'circle-dot', border: 'dashed', tone: 'neutral' },
  connected: { key: 'connected', text: 'Đã nhận tín hiệu', icon: 'wifi', border: 'solid', tone: 'ok' },
  uninstalled: { key: 'uninstalled', text: 'Đã gỡ', icon: 'check', border: 'solid', tone: 'muted' },
  'stopped-sending': { key: 'stopped-sending', text: 'Đã dừng gửi', icon: 'log-out', border: 'solid', tone: 'muted' },
  'still-sending': { key: 'still-sending', text: 'Vẫn gửi sau khi dừng', icon: 'triangle-alert', border: 'solid', tone: 'warn' },
};

/** The states the mentor tells apart (PRODUCT.md §7.34): still sending after the stop beats the stored connection. */
export function connectionLabel(row: Pick<TrainingMemberRow, 'connection' | 'stillSending'>): ConnectionLabel {
  if (row.stillSending) return LABELS['still-sending'];
  return row.connection === 'stopped_sending' ? LABELS['stopped-sending'] : LABELS[row.connection];
}
