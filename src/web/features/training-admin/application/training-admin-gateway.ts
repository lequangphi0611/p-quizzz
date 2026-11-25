import type { CreatedTraining, TeachingExampleBody, TeachingExampleRow, TrainingDetail, TrainingEventDetail, TrainingEventsPage, TrainingExportSummary, TrainingSummary } from '../../../../shared/api/index.js';
import type { ExportParams } from '../domain/export.js';

/** Port: the mentor's view of AI trainings (`/api/admin/trainings`, PRODUCT.md §7.34). */
export interface TrainingAdminGateway {
  /** Newest first. */
  list(): Promise<TrainingSummary[]>;
  /** Opens a training at once; the answer carries the room code. */
  create(name: string, options?: { allowAutoAccept?: boolean }): Promise<CreatedTraining>;
  get(id: number): Promise<TrainingDetail>;
  /** "Dừng thu": answers with the training as it now is. */
  stop(id: number): Promise<TrainingDetail>;
  /** "Kết thúc": deletes everything collected. Answers with the training as it now is. */
  end(id: number): Promise<TrainingDetail>;
  removeMember(trainingId: number, memberId: number): Promise<void>;
  /** "Duyệt xoá": deletes the data of a member who stopped sending (409 for anyone else). */
  purgeMember(trainingId: number, memberId: number): Promise<void>;
  /** A member's timeline, oldest first, at most 500 per call; `after` = the last event id already shown. */
  events(trainingId: number, memberId: number, after?: number): Promise<TrainingEventsPage>;
  /** Output and change of one event, fetched only when the mentor opens them. */
  eventDetail(trainingId: number, eventId: number): Promise<TrainingEventDetail>;
  /** Marks or unmarks an event as an example for the report. Both are idempotent. */
  mark(trainingId: number, eventId: number, marked: boolean): Promise<void>;
  /** The mentor's note for the report; an empty note clears it. */
  saveNote(trainingId: number, memberId: number, note: string): Promise<void>;
  /** The report as Markdown, for the preview: does not count as an export. */
  reportPreview(trainingId: number): Promise<string>;
  /** The report as Markdown for the file: the server records that it was exported. */
  exportReport(trainingId: number): Promise<string>;
  /** Makes (or replaces) a prompt as a teaching example (S44). 409 `no_teaching_consent` when the member did not tick. */
  saveTeachingExample(trainingId: number, eventId: number, body: TeachingExampleBody): Promise<TeachingExampleRow>;
  /** Drops the example; idempotent. */
  deleteTeachingExample(trainingId: number, eventId: number): Promise<void>;
  /** Every example with the prompt and context as they would go in the file, for the review screen. */
  teachingExamples(trainingId: number): Promise<TeachingExampleRow[]>;
  /** "Đã rà ví dụ này" (true) or taking it back (false), kept on the server. */
  setTeachingReviewed(trainingId: number, eventId: number, reviewed: boolean): Promise<void>;
  /** The Markdown file of the examples (400 `examples_not_reviewed` until every example is reviewed). Not the report: nothing is recorded as exported. */
  exportTeachingExamples(trainingId: number): Promise<string>;
  /** How many members and events the chosen days and members hold, and how big the zip would be (S41). Nothing is built. */
  exportSummary(trainingId: number, params: ExportParams): Promise<TrainingExportSummary>;
  /** The zip of the raw data for the mentor's own AI (S41). It is not the report: nothing is recorded as exported. */
  exportData(trainingId: number, params: ExportParams): Promise<Blob>;
  /** LAN addresses members can type (`/api/network`), to show next to the room code. */
  getJoinHosts(): Promise<string[]>;
  /**
   * "Ẩn nội dung" (the page may be on a projector): remembered in this mentor's browser only. Synchronous and never
   * throws; without storage (private window) it answers `false` and forgets.
   */
  readHideContent(): boolean;
  writeHideContent(hide: boolean): void;
}
