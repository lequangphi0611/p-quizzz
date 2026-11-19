import { describe, expect, it } from 'vitest';
import { canShare, shareLink, shareWarnings } from './share-ui.js';

describe('share-ui', () => {
  it('only ended sessions can be shared', () => {
    expect(['draft', 'lobby', 'running', 'closed', 'finalized'].map(s => canShare(s as never))).toEqual([false, false, false, true, true]);
  });

  it('builds the LAN link', () => {
    expect(shareLink('192.168.1.5:3000', 'abc')).toBe('http://192.168.1.5:3000/shared/abc');
  });

  it('warns about unfinished sessions of the exam and about few submissions (below 5)', () => {
    expect(shareWarnings({ examUnfinishedSessions: 2, submitted: 4 })).toEqual({ unfinished: 2, fewSubmissions: 4 });
    expect(shareWarnings({ examUnfinishedSessions: 0, submitted: 5 })).toEqual({ unfinished: 0, fewSubmissions: null });
    expect(shareWarnings({ examUnfinishedSessions: 0, submitted: 0 }).fewSubmissions).toBe(0);
  });
});
