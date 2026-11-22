/** Within this many pixels of the bottom the timeline counts as "at the end" and follows new events. */
export const BOTTOM_THRESHOLD_PX = 80;

export interface ScrollMetrics { scrollTop: number; clientHeight: number; scrollHeight: number }

export const isNearBottom = (m: ScrollMetrics, threshold = BOTTOM_THRESHOLD_PX): boolean => m.scrollHeight - m.scrollTop - m.clientHeight <= threshold;
