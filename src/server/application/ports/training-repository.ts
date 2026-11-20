import type { Training, TrainingMember } from '../../domain/training/training.js';

export interface NewTraining {
  name: string;
  roomCode: string;
  createdAt: Date;
}

export interface NewTrainingMember {
  trainingId: number;
  displayName: string;
  token: string;
  ingestToken: string;
  consentedAt: Date;
}

export type TrainingPatch = Partial<Pick<Training, 'status' | 'roomCode' | 'stoppedAt' | 'endedAt' | 'memberCount'>>;

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
}

export interface TrainingUnitContext {
  trainings: TrainingRepository;
  members: TrainingMemberRepository;
}
