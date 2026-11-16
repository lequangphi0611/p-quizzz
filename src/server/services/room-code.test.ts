import { describe, expect, it } from 'vitest';
import { createDb } from '../db/client.js';
import { exams, sessions } from '../db/schema.js';
import { newRoomCode } from './room-code.js';

describe('room codes', () => {
  it('newRoomCode skips a code another session already uses', () => {
    const db = createDb(':memory:');
    const exam = db.insert(exams).values({ title: 't', sourceMarkdown: '#', totalPoints: 1, createdAt: new Date() }).returning().get();
    db.insert(sessions).values({ examId: exam.id, roomCode: '123456', createdAt: new Date() }).run();
    const picks = [123456, 123456, 654321];
    expect(newRoomCode(db, () => picks.shift()!)).toBe('654321');
  });
});
