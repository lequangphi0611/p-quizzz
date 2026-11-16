import { describe, expect, it } from 'vitest';
import { FakeRandom } from '../../testing/fakes.js';
import { newRoomCode } from './new-room-code.js';

describe('newRoomCode', () => {
  it('skips a code another session already uses', async () => {
    const taken = new Set(['123456']);
    const code = await newRoomCode(new FakeRandom([123456, 123456, 654321]), async c => taken.has(c));
    expect(code).toBe('654321');
  });

  it('gives up after 50 collisions', async () => {
    await expect(newRoomCode(new FakeRandom([1]), async () => true)).rejects.toThrow('Không tạo được mã phòng duy nhất');
  });
});
