import { describe, expect, it } from 'vitest';
import { isCardReadable, keepAnchorScrollTop, latestSide } from './scroll.js';

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

describe('isCardReadable', () => {
  const view = { top: 100, bottom: 600 };
  it('needs half of the card in the frame', () => {
    expect(isCardReadable({ top: 200, bottom: 280 }, view)).toBe(true);
    expect(isCardReadable({ top: 60, bottom: 140 }, view)).toBe(true); // 40 of 80 px: exactly half counts
    expect(isCardReadable({ top: 59, bottom: 139 }, view)).toBe(false); // 39 of 80 px
    expect(isCardReadable({ top: 570, bottom: 650 }, view)).toBe(false); // 30 of 80 px
    expect(isCardReadable({ top: 560, bottom: 640 }, view)).toBe(true); // 40 of 80 px
    expect(isCardReadable({ top: 700, bottom: 780 }, view)).toBe(false);
  });
  it('a card taller than the frame needs 200px of it', () => {
    expect(isCardReadable({ top: 0, bottom: 1000 }, view)).toBe(true);
    expect(isCardReadable({ top: 500, bottom: 1500 }, view)).toBe(false); // 100px
    expect(isCardReadable({ top: 380, bottom: 1500 }, view)).toBe(true); // 220px
  });
});
