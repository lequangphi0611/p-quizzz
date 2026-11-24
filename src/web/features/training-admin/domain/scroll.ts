/** Within this many pixels of the viewport the newest event still counts as "being followed". */
export const FOLLOW_THRESHOLD_PX = 80;

export interface Span { top: number; bottom: number }

/**
 * Whether the newest event is in (or within `threshold` of) the viewport: "đang theo dõi". Both spans are in the same
 * coordinates (viewport pixels from `getBoundingClientRect`). The newest event is no longer at the bottom of the list:
 * days run newest first, so it sits at the end of the first day group.
 */
export const isLatestInView = (latest: Span, view: Span, threshold = FOLLOW_THRESHOLD_PX): boolean =>
  latest.bottom >= view.top - threshold && latest.top <= view.bottom + threshold;

/** Where the newest event is relative to the viewport: the "N sự kiện mới" chip sits on the edge of that side. */
export type LatestSide = 'above' | 'in' | 'below';

export function latestSide(latest: Span, view: Span): LatestSide {
  if (latest.bottom < view.top) return 'above';
  if (latest.top > view.bottom) return 'below';
  return 'in';
}

/**
 * The `scrollTop` that keeps an anchor element where it was: it sat `before` pixels below the viewport top and now sits
 * `after` pixels below it, so the content moved by the difference and the scroll position follows.
 */
export const keepAnchorScrollTop = (scrollTop: number, before: number, after: number): number => scrollTop + (after - before);
