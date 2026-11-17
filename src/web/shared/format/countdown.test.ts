import { describe, expect, it } from 'vitest';
import { countdownLevel, formatCountdown, formatMinutes } from './countdown.js';

describe('countdown', () => {
  it('formats mm:ss and h:mm:ss, rounding up', () => {
    expect(formatCountdown(30 * 60_000)).toBe('30:00');
    expect(formatCountdown(59_001)).toBe('01:00');
    expect(formatCountdown(1)).toBe('00:01');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00');
    expect(formatCountdown(65 * 60_000)).toBe('1:05:00');
  });

  it('stages: normal, 5 minutes, last minute, time up', () => {
    expect(countdownLevel(5 * 60_000 + 1)).toBe('normal');
    expect(countdownLevel(5 * 60_000)).toBe('soon');
    expect(countdownLevel(60_000)).toBe('last');
    expect(countdownLevel(0)).toBe('up');
  });

  it('formats minutes for people', () => {
    expect(formatMinutes(45)).toBe('45 phút');
    expect(formatMinutes(60)).toBe('1 giờ');
    expect(formatMinutes(90)).toBe('1 giờ 30 phút');
  });
});
