import type { Training, TrainingMember } from '../../domain/training/training.js';
import type { TrainingEventRepository } from './training-event-repository.js';

export interface NewTraining {
  name: string;
  roomCode: string;
  createdAt: Date;
  allowAutoAccept: boolean;
}

export interface NewTrainingMember {
  trainingId: number;
  displayName: string;
  token: string;
  ingestToken: string;
  consentedAt: Date;
  teachingConsent: boolean;
}

export type TrainingPatch = Partial<Pick<Training, 'status' | 'roomCode' | 'stoppedAt' | 'endedAt' | 'memberCount' | 'reportExportedAt'>>;

/** A training in the list, with how many members it has (counted live until it ends). */
export interface TrainingListItem extends Training {
  liveMemberCount: number;
}

/** Read side: usable outside a unit of work. */
export interface TrainingReader {
  findById(id: number): Promise<Training | null>;
  /** Only an `open` training has a code, so this is also "is it open". */
  findOpenByRoomCode(code: string): Promise<Training | null>;
  /** Newest first. */
  list(): Promise<TrainingListItem[]>;
}

/** Write side: only reachable inside a unit of work (see `TrainingUnitContext`). */
export interface TrainingRepository {
  findById(id: number): Promise<Training | null>;
  create(training: NewTraining): Promise<Training>;
  update(id: number, patch: TrainingPatch): Promise<Training>;
  /** True when a session or a training already uses this code: the two share one code space. */
  roomCodeInUse(code: string): Promise<boolean>;
}

export interface TrainingMemberReader {
  findById(id: number): Promise<TrainingMember | null>;
  findByToken(token: string): Promise<TrainingMember | null>;
  /** The token that sits in the hook config on the member's machine (unique index: one lookup per hook call). */
  findByIngestToken(token: string): Promise<TrainingMember | null>;
  listByTraining(trainingId: number): Promise<TrainingMember[]>;
}

export interface TrainingMemberRepository extends TrainingMemberReader {
  /** Throws `NameTakenError('identity_in_use')` when the database's name index rejects the row. */
  add(member: NewTrainingMember): Promise<TrainingMember>;
  /** Deletes the member and, by cascade, every event of theirs. */
  delete(id: number): Promise<void>;
  /** Deletes every member of the training (and their events); returns how many there were. */
  deleteByTraining(trainingId: number): Promise<number>;
  count(trainingId: number): Promise<number>;
  /** An event arrived while open: `first_seen_at` is set once, `last_seen_at` moves. */
  recordSeen(id: number, at: Date): Promise<void>;
  /** The member pressed "Dừng gửi": set once, later calls keep the first time. */
  stopSending(id: number, at: Date): Promise<void>;
  /** An event arrived after "Dừng thu" or "Dừng gửi": the hook is still installed. */
  recordSeenAfterStop(id: number, at: Date): Promise<void>;
  /** The member began the removal check (asking again starts over). */
  startUninstallCheck(id: number, at: Date): Promise<void>;
  finishUninstall(id: number, at: Date): Promise<void>;
  /** The mentor's note for the report; null clears it. */
  setNote(id: number, note: string | null): Promise<void>;
}

export interface TrainingUnitContext {
  trainings: TrainingRepository;
  members: TrainingMemberRepository;
  events: TrainingEventRepository;
}
