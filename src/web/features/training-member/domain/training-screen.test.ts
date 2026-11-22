import { describe, expect, it } from 'vitest';
import type { MyTraining } from '../../../../shared/api/index.js';
import { decideTrainingScreen, type CheckProgress, type RoomInfo, type TrainingScreen } from './training-screen.js';

const me = (status: MyTraining['training']['status'], connection: MyTraining['member']['connection'] = 'waiting', uninstallCheck: MyTraining['member']['uninstallCheck'] = 'none'): MyTraining => ({
  training: { id: 7, name: 'Claude Code buổi 2', status },
  member: { displayName: 'An', connection, uninstallCheck },
});
const idle: CheckProgress = { phase: 'idle', result: null };
const none: RoomInfo = { status: 'none' };

const screen = (over: Partial<Parameters<typeof decideTrainingScreen>[0]>): TrainingScreen =>
  decideTrainingScreen({ hasToken: true, gone: false, me: null, offline: false, room: none, check: idle, ...over });

describe('decideTrainingScreen: before joining (no token)', () => {
  it('shows the consent screen once the room code led to this training', () => {
    expect(screen({ hasToken: false, room: { status: 'ok' } })).toBe('consent');
  });
  it('waits while the code is looked up', () => {
    expect(screen({ hasToken: false, room: { status: 'checking' } })).toBe('loading');
  });
  it('a code that leads nowhere (wrong, stopped, missing) is "lost", never a consent form', () => {
    expect(screen({ hasToken: false, room: { status: 'error', errorStatus: 403 } })).toBe('lost');
    expect(screen({ hasToken: false, room: none })).toBe('lost');
  });
  it('cannot reach the mentor machine while looking the code up: offline, not "lost"', () => {
    expect(screen({ hasToken: false, room: { status: 'error', errorStatus: 0 } })).toBe('offline');
  });
});

describe('decideTrainingScreen: joined, while the training is open', () => {
  it('loading until the first answer; offline when that answer cannot come', () => {
    expect(screen({ me: null })).toBe('loading');
    expect(screen({ me: null, offline: true })).toBe('offline');
  });
  it('waiting for the first signal is the install screen', () => {
    expect(screen({ me: me('open', 'waiting') })).toBe('install');
  });
  it('a signal received means recording', () => {
    expect(screen({ me: me('open', 'connected') })).toBe('recording');
  });
  it('losing the connection later keeps what is known on screen (the page shows a banner instead)', () => {
    expect(screen({ me: me('open', 'connected'), offline: true })).toBe('recording');
    expect(screen({ me: me('open', 'waiting'), offline: true })).toBe('install');
  });
});

describe('decideTrainingScreen: the mentor stopped recording', () => {
  it('shows the removal steps first', () => {
    expect(screen({ me: me('stopped', 'connected') })).toBe('remove');
    expect(screen({ me: me('stopped', 'waiting') })).toBe('remove');
  });
  it('this browser started the check: the check screen, even before the server says anything', () => {
    expect(screen({ me: me('stopped', 'connected', 'none'), check: { phase: 'starting', result: null } })).toBe('check');
    expect(screen({ me: me('stopped', 'connected', 'waiting'), check: { phase: 'running', result: null } })).toBe('check');
  });
  it('a signal arriving during the check does not end it by itself: the verdict comes with "Xong"', () => {
    expect(screen({ me: me('stopped', 'connected', 'failed'), check: { phase: 'running', result: null } })).toBe('check');
  });
  it('a reload in the middle of the check returns to it', () => {
    expect(screen({ me: me('stopped', 'connected', 'waiting') })).toBe('check');
  });
  it('the verdicts', () => {
    expect(screen({ me: me('stopped', 'connected', 'none'), check: { phase: 'idle', result: 'failed' } })).toBe('check-failed');
    expect(screen({ me: me('stopped', 'connected', 'none'), check: { phase: 'idle', result: 'passed' } })).toBe('removed');
    expect(screen({ me: me('stopped', 'uninstalled', 'passed') })).toBe('removed');
    expect(screen({ me: me('stopped', 'connected', 'failed') })).toBe('check-failed'); // after a reload
  });
  it('a check that passed stays passed even if a stale "failed" is still around', () => {
    expect(screen({ me: me('stopped', 'uninstalled', 'passed'), check: { phase: 'idle', result: 'failed' } })).toBe('removed');
  });
});

describe('decideTrainingScreen: "Dừng gửi" (S38)', () => {
  it('a member who stopped sending while open sees the sending-stopped screen, not recording or install', () => {
    expect(screen({ me: me('open', 'stopped_sending') })).toBe('sending-stopped');
  });
  it('once the mentor stops the training the removal steps take over, as for everyone', () => {
    expect(screen({ me: me('stopped', 'stopped_sending', 'none') })).toBe('remove');
    expect(screen({ me: me('stopped', 'stopped_sending', 'waiting') })).toBe('check');
  });
  it('gone after stopping sending is "deleted"; gone otherwise stays "ended"', () => {
    expect(screen({ gone: true, deleted: true, hasToken: false })).toBe('deleted');
    expect(screen({ gone: true, hasToken: false })).toBe('ended');
  });
});

describe('decideTrainingScreen: it is over', () => {
  it('401 (gone) is the ended screen whatever else is known', () => {
    expect(screen({ gone: true, me: me('open', 'connected') })).toBe('ended');
    expect(screen({ gone: true, hasToken: false })).toBe('ended');
  });
  it('a status of ended is the ended screen too', () => {
    expect(screen({ me: me('ended') })).toBe('ended');
  });
});
