import { describe, expect, it } from 'vitest';
import { keepAnchorScrollTop, latestSide } from './scroll.js';

describe('latestSide', () => {
  const view = { top: 100, bottom: 600 };
  it('says on which side of the viewport the newest event is', () => {
    expect(latestSide({ top: 20, bottom: 90 }, view)).toBe('above');
    expect(latestSide({ top: 650, bottom: 700 }, view)).toBe('below');
    expect(latestSide({ top: 580, bottom: 640 }, view)).toBe('in');
  });
});

describe('keepAnchorScrollTop', () => {
  it('moves the scroll position by as much as the anchor moved, so it stays where it was', () => {
    expect(keepAnchorScrollTop(300, 40, 40)).toBe(300);
    expect(keepAnchorScrollTop(300, 40, 190)).toBe(450); // 150px were inserted above it
    expect(keepAnchorScrollTop(300, 40, -60)).toBe(200); // 100px above it were folded away
  });
});
