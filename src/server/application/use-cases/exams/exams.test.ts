import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExamInUseError, ExamNotFoundError } from '../../../domain/exam/errors.js';
import { InMemoryExamRepository, InMemoryExamUnitOfWork } from '../../testing/in-memory-exam-repository.js';
import { DeleteExam } from './delete-exam.js';
import { InvalidExamError } from './errors.js';
import { GetExam } from './get-exam.js';
import { ImportExam } from './import-exam.js';
import { ListExams } from './list-exams.js';
import { PreviewExam } from './preview-exam.js';

const sample = readFileSync('exams/examples/git-co-ban.md', 'utf8');
const broken = '---\ntitle: Hỏng\n---\n\n## Câu không có đáp án đúng\n- [ ] A\n- [ ] B\n';

let repo: InMemoryExamRepository;
let clock: number;
const build = () => {
  const unitOfWork = new InMemoryExamUnitOfWork(repo);
  return {
    preview: new PreviewExam(),
    importExam: new ImportExam({ unitOfWork, exams: repo, now: () => new Date(clock++) }),
    list: new ListExams(repo),
    get: new GetExam(repo),
    remove: new DeleteExam(unitOfWork),
  };
};

beforeEach(() => {
  repo = new InMemoryExamRepository();
  clock = 1000;
});

describe('PreviewExam', () => {
  it('returns the parse result and stores nothing', async () => {
    const result = build().preview.execute(sample);
    expect(result.exam?.questions).toHaveLength(4);
    expect(await repo.list()).toEqual([]);
  });
});

describe('ImportExam', () => {
  it('stores the exam and returns its summary with the parser warnings', async () => {
    const { exam, warnings } = await build().importExam.execute(sample);
    expect(exam).toMatchObject({ title: 'Ôn tập Git cơ bản', questionCount: 4, totalPoints: 9, hasEssay: true, sessionCount: 0, createdAt: new Date(1000) });
    expect(warnings).toEqual(build().preview.execute(sample).warnings);
    expect((await repo.findById(exam.id))!.sourceMarkdown).toBe(sample);
  });

  it('rejects an invalid file with the parser errors and stores nothing', async () => {
    const err = await build().importExam.execute(broken).catch(e => e);
    expect(err).toBeInstanceOf(InvalidExamError);
    expect((err as InvalidExamError).errors.length).toBeGreaterThan(0);
    expect(await repo.list()).toEqual([]);
  });

  it('leaves nothing behind when storing fails half-way', async () => {
    repo.failAfterAdd = new Error('disk full');
    await expect(build().importExam.execute(sample)).rejects.toThrow('disk full');
    expect(await repo.list()).toEqual([]);
  });
});

describe('ListExams / GetExam', () => {
  it('lists newest first', async () => {
    const uc = build();
    const first = await uc.importExam.execute(sample);
    const second = await uc.importExam.execute(sample);
    expect((await uc.list.execute()).map(e => e.id)).toEqual([second.exam.id, first.exam.id]);
  });

  it('returns summary and full exam, or ExamNotFoundError', async () => {
    const uc = build();
    const { exam } = await uc.importExam.execute(sample);
    const detail = await uc.get.execute(exam.id);
    expect(detail.summary.id).toBe(exam.id);
    expect(detail.exam.questions.map(q => q.type)).toEqual(['single', 'multi', 'single', 'essay']);
    await expect(uc.get.execute(999)).rejects.toBeInstanceOf(ExamNotFoundError);
  });
});

describe('DeleteExam', () => {
  it('deletes an unused exam', async () => {
    const uc = build();
    const { exam } = await uc.importExam.execute(sample);
    await uc.remove.execute(exam.id);
    expect(await repo.findSummary(exam.id)).toBeNull();
  });

  it('refuses an exam that a session uses (ExamInUseError) and keeps it', async () => {
    const uc = build();
    const { exam } = await uc.importExam.execute(sample);
    repo.setSessionCount(exam.id, 1);
    await expect(uc.remove.execute(exam.id)).rejects.toBeInstanceOf(ExamInUseError);
    expect(await repo.findSummary(exam.id)).not.toBeNull();
  });

  it('ExamNotFoundError for an unknown exam', async () => {
    await expect(build().remove.execute(999)).rejects.toBeInstanceOf(ExamNotFoundError);
  });
});
