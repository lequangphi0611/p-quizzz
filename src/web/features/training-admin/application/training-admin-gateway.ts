import type { CreatedTraining, TrainingDetail, TrainingEventDetail, TrainingEventsPage, TrainingSummary } from '../../../../shared/api/index.js';

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
  /** LAN addresses members can type (`/api/network`), to show next to the room code. */
  getJoinHosts(): Promise<string[]>;
  /**
   * "Ẩn nội dung" (the page may be on a projector): remembered in this mentor's browser only. Synchronous and never
   * throws; without storage (private window) it answers `false` and forgets.
   */
  readHideContent(): boolean;
  writeHideContent(hide: boolean): void;
}
