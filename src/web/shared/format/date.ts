export const formatDate = (ms: number) => new Date(ms).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** "13:45" — hour and minute only. */
export const formatClock = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
