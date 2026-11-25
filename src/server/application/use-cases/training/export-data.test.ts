import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRAINING_EXPORT_MAX_BYTES } from '../../../../shared/api/training.js';
import { TrainingExportEmptyError, TrainingExportTooLargeError, TrainingMemberNotFoundError, TrainingNotFoundError, TrainingStateError } from '../../../domain/training/errors.js';
import { postToolUseBash, userPromptSubmit } from '../../../domain/training/fixtures/hook-payloads.js';
import type { ArchiveFile, ArchiveWriter } from '../../ports/archive-writer.js';
import { FakeClock, FakeRandom, FakeTokenGenerator, RecordingTrainingSignals } from '../../testing/fakes.js';
import { InMemoryTrainingEventRepository } from '../../testing/in-memory-training-event-repository.js';
import { InMemoryTrainingMemberRepository, InMemoryTrainingRepository } from '../../testing/in-memory-training-repository.js';
import { InMemoryUnitOfWork } from '../../testing/in-memory-unit-of-work.js';
import { CreateTraining, EndTraining, StopTraining } from './admin.js';
import { ExportTrainingData, GetTrainingExportSummary } from './export-data.js';
import { IngestHookEvent } from './ingest.js';
import { JoinTraining } from './member.js';

class FakeArchive implements ArchiveWriter {
  last: readonly ArchiveFile[] = [];
  async zip(files: Iterable<ArchiveFile> | AsyncIterable<ArchiveFile>) {
    const all: ArchiveFile[] = [];
    for await (const f of files) all.push(f);
    this.last = all;
    return Buffer.from('zip');
  }
}

const noon = (d: number) => new Date(2026, 10, d, 12, 0);

let members: InMemoryTrainingMemberRepository;
let trainings: InMemoryTrainingRepository;
let events: InMemoryTrainingEventRepository;
let clock: FakeClock;
let archive: FakeArchive;

function build() {
  const signals = new RecordingTrainingSignals();
  const unitOfWork = new InMemoryUnitOfWork({ trainings, members, events }, [trainings, members, events]);
  const deps = { unitOfWork, clock, signals };
  const read = { trainings, members, events, clock, archive };
  return {
    create: new CreateTraining({ ...deps, random: new FakeRandom([111111]) }),
    stop: new StopTraining(deps),
    end: new EndTraining(deps),
    join: new JoinTraining({ ...deps, tokens: new FakeTokenGenerator() }),
    ingest: new IngestHookEvent({ members, trainings, unitOfWork, clock, signals }),
    summary: new GetTrainingExportSummary(read),
    export: new ExportTrainingData(read),
  };
}

/** A training with `Lan` and `Mai`; Lan sent a prompt on the 23rd, a command on the 24th (still that prompt's turn), then a new prompt and command on the 24th. */
async function scenario() {
  const uc = build();
  clock.set(noon(23));
  const t = await uc.create.execute('Buổi 1');
  const lan = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
  const mai = await uc.join.execute({ trainingId: t.id, displayName: 'Mai', roomCode: '111111' });
  const lanRow = (await members.findByToken(lan.token))!;
  const maiRow = (await members.findByToken(mai.token))!;
  await uc.ingest.execute(lanRow.ingestToken, userPromptSubmit);
  clock.set(noon(24));
  await uc.ingest.execute(lanRow.ingestToken, postToolUseBash);
  await uc.ingest.execute(lanRow.ingestToken, { ...userPromptSubmit, prompt: 'Sửa lỗi tính tổng' });
  await uc.ingest.execute(lanRow.ingestToken, postToolUseBash);
  return { uc, t, lan: lanRow, mai: maiRow };
}

beforeEach(() => {
  members = new InMemoryTrainingMemberRepository();
  trainings = new InMemoryTrainingRepository(members);
  events = new InMemoryTrainingEventRepository(members);
  clock = new FakeClock(noon(24));
  archive = new FakeArchive();
});

describe('GetTrainingExportSummary', () => {
  it('defaults to today and to the whole class, and counts only what falls in the days', async () => {
    const { uc, t } = await scenario();
    expect(await uc.summary.execute(t.id, {})).toMatchObject({ from: '2026-11-24', to: '2026-11-24', memberCount: 2, eventCount: 2, tooLarge: false }); // the command of the 24th that belongs to the prompt of the 23rd is not counted
    expect(await uc.summary.execute(t.id, { from: '2026-11-23', to: '2026-11-24' })).toMatchObject({ eventCount: 4 });
  });

  it('flags a size over the limit without building anything', async () => {
    const { uc, t, lan } = await scenario();
    vi.spyOn(events, 'exportStats').mockResolvedValue(new Map([[lan.id, { eventCount: 1, approxBytes: TRAINING_EXPORT_MAX_BYTES + 1 }]]));
    expect(await uc.summary.execute(t.id, {})).toMatchObject({ tooLarge: true });
  });

  it('refuses an unknown training, an ended one and a member that is not in it', async () => {
    const { uc, t } = await scenario();
    await expect(uc.summary.execute(999, {})).rejects.toBeInstanceOf(TrainingNotFoundError);
    await expect(uc.summary.execute(t.id, { members: [999] })).rejects.toBeInstanceOf(TrainingMemberNotFoundError);
    await uc.stop.execute(t.id);
    await uc.end.execute(t.id);
    await expect(uc.summary.execute(t.id, {})).rejects.toBeInstanceOf(TrainingStateError);
  });
});

describe('ExportTrainingData', () => {
  it('packs the overview and one file per member through the archive port, and names the download after the days', async () => {
    const { uc, t } = await scenario();
    const out = await uc.export.execute(t.id, { from: '2026-11-23', to: '2026-11-24' });
    expect(archive.last.map(f => f.name)).toEqual(['01-lan.md', '02-mai.md', '00-tong-quan.md']);
    expect(out.data.toString()).toBe('zip');
    expect(out.fileName).toBe(`du-lieu-training-${t.id}-2026-11-23_2026-11-24.zip`);
    expect(out.summary).toMatchObject({ memberCount: 2, eventCount: 4 });
  });

  it('with no days, takes today by the clock', async () => {
    const { uc, t } = await scenario();
    const out = await uc.export.execute(t.id, {});
    expect(out.fileName).toBe(`du-lieu-training-${t.id}-2026-11-24.zip`);
    expect(archive.last.find(f => f.name === '01-lan.md')!.content).toContain('**Bash**');
    expect(archive.last.find(f => f.name === '01-lan.md')!.content).not.toContain('Viết hàm cộng hai số'); // yesterday
  });

  it('only the chosen members; a chosen member with nothing in the days leaves nothing to build', async () => {
    const { uc, t, lan, mai } = await scenario();
    await uc.export.execute(t.id, { members: [lan.id], from: '2026-11-23' });
    expect(archive.last.map(f => f.name)).toEqual(['01-lan.md', '00-tong-quan.md']);
    await expect(uc.export.execute(t.id, { members: [mai.id], from: '2026-11-23' })).rejects.toBeInstanceOf(TrainingExportEmptyError);
  });

  it('refuses to build a file with nothing in it', async () => {
    const { uc, t } = await scenario();
    await expect(uc.export.execute(t.id, { from: '2026-11-01' })).rejects.toBeInstanceOf(TrainingExportEmptyError);
    expect(archive.last).toEqual([]);
  });

  it('refuses a size over the limit, with how big it is', async () => {
    const { uc, t, lan } = await scenario();
    vi.spyOn(events, 'exportStats').mockResolvedValue(new Map([[lan.id, { eventCount: 1, approxBytes: 300 * 1024 * 1024 }]]));
    const err = await uc.export.execute(t.id, {}).catch(e => e);
    expect(err).toBeInstanceOf(TrainingExportTooLargeError);
    expect(err.message).toContain('300 MB');
    expect(archive.last).toEqual([]);
  });
});

describe('ExportTrainingData: a day of a longer training (PRODUCT.md §7.37a, §7.38e)', () => {
  const session = (id: string) => ({ session_id: id });
  const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m);

  async function twoDays() {
    const uc = build();
    clock.set(noon(23));
    const t = await uc.create.execute('Buổi 1');
    const lan = await uc.join.execute({ trainingId: t.id, displayName: 'Lan', roomCode: '111111' });
    const row = (await members.findByToken(lan.token))!;
    const send = async (when: Date, payload: object) => { clock.set(when); await uc.ingest.execute(row.ingestToken, payload); };
    // Yesterday: sessions x and y; a prompt of x at 23:40 whose command runs at 00:05. Today: session z, and x goes on after midnight with its command.
    await send(at(23, 9, 0), { ...userPromptSubmit, ...session('x'), prompt: 'x1' });
    await send(at(23, 9, 5), { ...userPromptSubmit, ...session('y'), prompt: 'y1' });
    await send(at(23, 23, 40), { ...userPromptSubmit, ...session('x'), prompt: 'x2 muộn' });
    await send(at(24, 0, 5), { ...postToolUseBash, ...session('x'), tool_input: { command: 'echo muộn' } });
    await send(at(24, 8, 0), { ...userPromptSubmit, ...session('z'), prompt: 'z1' });
    await send(at(24, 8, 5), { ...postToolUseBash, ...session('z'), tool_input: { command: 'echo z' } });
    return { uc, t };
  }
  const lanFile = () => archive.last.find(f => f.name === '01-lan.md')!.content;

  it('numbers the sessions over the whole training, not over the days exported', async () => {
    const { uc, t } = await twoDays();
    clock.set(noon(24));
    await uc.export.execute(t.id, {}); // today only
    expect(lanFile()).toContain('#### Phiên Claude Code 3 · 08:00–08:05');
    expect(lanFile()).not.toContain('Phiên Claude Code 1');
  });

  it('a command after midnight stays in the file of the day of its prompt, in both directions', async () => {
    const { uc, t } = await twoDays();
    clock.set(noon(24));
    await uc.export.execute(t.id, {});
    expect(lanFile()).toContain('echo z');
    expect(lanFile()).not.toContain('echo muộn'); // it is under the prompt of yesterday 23:40
    expect(lanFile()).not.toContain('Trước prompt đầu tiên');
    await uc.export.execute(t.id, { from: '2026-11-23', to: '2026-11-23' });
    expect(lanFile()).toContain('x2 muộn');
    expect(lanFile()).toContain('echo muộn');
    expect(lanFile()).toContain('#### Phiên Claude Code 2 · 09:05–09:05');
    expect(lanFile()).not.toContain('echo z');
  });
});
