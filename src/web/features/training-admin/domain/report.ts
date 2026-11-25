import type { TrainingDetail, TrainingMemberRow } from '../../../../shared/api/index.js';

/** The name without accents, spaces and symbols, so it is safe on any file system (empty when nothing is left). */
export function slugOf(trainingName: string): string {
  return trainingName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/** `bao-cao-buoi-1.md` */
export function reportFileName(trainingName: string): string {
  return `bao-cao-${slugOf(trainingName) || 'training'}.md`;
}

export interface ReportSummary {
  /** Events marked as examples, over all members. */
  marked: number;
  /** Members with a note. */
  notes: number;
  /** Nothing was marked and nothing was written: the report is only figures and flags. */
  empty: boolean;
}

export function reportSummary(members: readonly Pick<TrainingMemberRow, 'markedCount' | 'mentorNote'>[]): ReportSummary {
  const marked = members.reduce((n, m) => n + m.markedCount, 0);
  const notes = members.filter(m => m.mentorNote !== null).length;
  return { marked, notes, empty: marked === 0 && notes === 0 };
}

/** The prompt before "Kết thúc": only while the report was never downloaded. */
export const needsExportReminder = (d: Pick<TrainingDetail, 'reportExportedAt'>): boolean => d.reportExportedAt === null;
