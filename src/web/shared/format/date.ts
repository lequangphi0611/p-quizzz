export const formatDate = (ms: number) => new Date(ms).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
