import { describe, expect, it } from 'vitest';
import { cleanRoomCode, formatRoomCode, joinLink, roomFromSearch } from './room-code.js';

describe('room code helpers', () => {
  it('cleanRoomCode keeps digits only, at most 6', () => {
    expect(cleanRoomCode('482 913')).toBe('482913');
    expect(cleanRoomCode('48-29-13')).toBe('482913');
    expect(cleanRoomCode('abc12')).toBe('12');
    expect(cleanRoomCode('12345678')).toBe('123456');
  });
  it('formatRoomCode groups a full code as 3 + 3', () => {
    expect(formatRoomCode('482913')).toBe('482 913');
    expect(formatRoomCode('4829')).toBe('4829');
  });
  it('roomFromSearch reads ?room= and ignores anything malformed', () => {
    expect(roomFromSearch('?room=482913')).toBe('482913');
    expect(roomFromSearch('?room=482%20913')).toBe('482913');
    expect(roomFromSearch('?room=4829')).toBe('');
    expect(roomFromSearch('?x=1')).toBe('');
    expect(roomFromSearch('')).toBe('');
  });
  it('joinLink puts the code in the query', () => {
    expect(joinLink('192.168.1.24:3000', '482913')).toBe('http://192.168.1.24:3000/?room=482913');
  });
});
