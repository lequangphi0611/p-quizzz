import { describe, expect, it } from 'vitest';
import { createDb } from '../db/client.js';
import { exams, sessions } from '../db/schema.js';
import { newRoomCode, randomRoomCode } from './room-code.js';

describe('room codes', () => {
  it('are always 6 digits, zero-padded', () => {
    expect(randomRoomCode(() => 7)).toBe('000007');
    expect(randomRoomCode(() => 999_999)).toBe('999999');
    for (let i = 0; i < 200; i++) expect(randomRoomCode()).toMatch(/^\d{6}$/);
  });

  it('are not sequential or constant', () => {
    const seen = new Set(Array.from({ length: 200 }, () => randomRoomCode()));
    expect(seen.size).toBeGreaterThan(190);
  });

  it('newRoomCode skips a code another session already uses', () => {
    const db = createDb(':memory:');
    const exam = db.insert(exams).values({ title: 't', sourceMarkdown: '#', totalPoints: 1, createdAt: new Date() }).returning().get();
    db.insert(sessions).values({ examId: exam.id, roomCode: '123456', createdAt: new Date() }).run();
    const picks = [123456, 123456, 654321];
    expect(newRoomCode(db, () => picks.shift()!)).toBe('654321');
  });
});
