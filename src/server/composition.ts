import type { Clock } from './application/ports/clock.js';
import type { EventPublisher } from './application/ports/event-publisher.js';
import type { ExamUnitContext } from './application/ports/exam-repository.js';
import type { AttemptUnitContext } from './application/ports/attempt-repository.js';
import type { ParticipantUnitContext } from './application/ports/participant-repository.js';
import type { SessionUnitContext } from './application/ports/session-repository.js';
import type { EventSubscriber } from './application/ports/event-subscriber.js';
import type { Random } from './application/ports/random.js';
import type { TokenGenerator } from './application/ports/token-generator.js';
import { CountUngradedEssays } from './application/use-cases/grading/essay-progress.js';
import { GetDiscussionView } from './application/use-cases/grading/get-discussion-view.js';
import { GetGradingView } from './application/use-cases/grading/get-grading-view.js';
import { GradeAnswer } from './application/use-cases/grading/grade-answer.js';
import { GetLeaderboard } from './application/use-cases/leaderboard/get-leaderboard.js';
import { GetProjectorRoom } from './application/use-cases/sessions/get-projector-room.js';
import { ListScreenSessions } from './application/use-cases/sessions/list-screen-sessions.js';
import { ResolveRoom } from './application/use-cases/sessions/resolve-room.js';
import { AutoSubmitOpenAttempts } from './application/use-cases/attempts/auto-submit-open-attempts.js';
import { FinishEdit, RequestEdit, ResolveEditRequest } from './application/use-cases/attempts/edit-request.js';
import { GetAttemptReview, GetAttemptView, GetMemberState, GetParticipantReview } from './application/use-cases/attempts/queries.js';
import { SaveAnswer } from './application/use-cases/attempts/save-answer.js';
import { StartAttempt } from './application/use-cases/attempts/start-attempt.js';
import { SubmitAttempt } from './application/use-cases/attempts/submit-attempt.js';
import { AuthenticateAdmin, GetAdminStatus, LoginAdmin, LogoutAdmin, SetupAdmin } from './application/use-cases/admin/admin-use-cases.js';
import { ApproveParticipant } from './application/use-cases/participants/approve-participant.js';
import { JoinSession } from './application/use-cases/participants/join-session.js';
import { KickParticipant } from './application/use-cases/participants/kick-participant.js';
import { ListPublicParticipants } from './application/use-cases/participants/list-public-participants.js';
import { RenameParticipant } from './application/use-cases/participants/rename-participant.js';
import { ResumeParticipant } from './application/use-cases/participants/resume-participant.js';
import { DeleteExam } from './application/use-cases/exams/delete-exam.js';
import { GetExam } from './application/use-cases/exams/get-exam.js';
import { ImportExam } from './application/use-cases/exams/import-exam.js';
import { ListExams } from './application/use-cases/exams/list-exams.js';
import { PreviewExam } from './application/use-cases/exams/preview-exam.js';
import { CloseSession } from './application/use-cases/sessions/close-session.js';
import { CreateSession } from './application/use-cases/sessions/create-session.js';
import { FinalizeSession } from './application/use-cases/sessions/finalize-session.js';
import { OpenSession } from './application/use-cases/sessions/open-session.js';
import { GetPublicSession, GetSessionDetail, ListSessions } from './application/use-cases/sessions/queries.js';
import { CreateGroup, DeleteGroup, GetGroup, ListGroups, UpdateGroup } from './application/use-cases/groups/groups.js';
import { AddRosterEmails, SaveSessionGroup } from './application/use-cases/sessions/roster.js';
import { GetRosterCounts } from './application/use-cases/participants/get-roster-counts.js';
import { DrizzleGroupRepository } from './infrastructure/db/drizzle-group-repository.js';
import { DrizzleRejoinRepository } from './infrastructure/db/drizzle-rejoin-repository.js';
import { InMemoryPresenceTracker } from './infrastructure/system/in-memory-presence-tracker.js';
import { AllowRejoin, ApproveRejoinKeep, ApproveRejoinTakeover, CancelRejoin, GetRejoinStatus, RejectRejoin, RequestRejoin } from './application/use-cases/rejoin/rejoin-requests.js';
import type { RejoinUseCases } from './interface/http/rejoin-routes.js';
import type { PresenceTracker } from './application/ports/presence-tracker.js';
import type { RejoinUnitContext } from './application/ports/participant-repository.js';
import type { GroupUnitContext } from './application/ports/group-repository.js';
import { StartSession } from './application/use-cases/sessions/start-session.js';
import { defaultSessionModes } from './domain/session/mode.js';
import type { Db } from './infrastructure/db/client.js';
import { InMemoryAdminSessionStore } from './infrastructure/auth/in-memory-admin-session-store.js';
import { ScryptPasswordHasher } from './infrastructure/auth/scrypt-password-hasher.js';
import { DrizzleAdminCredentialStore } from './infrastructure/db/drizzle-admin-credential-store.js';
import { DrizzleParticipantRepository } from './infrastructure/db/drizzle-participant-repository.js';
import { DrizzleExamRepository } from './infrastructure/db/drizzle-exam-repository.js';
import { SqliteDatabase, SqliteUnitOfWork } from './infrastructure/db/sqlite-database.js';
import { DrizzleAttemptRepository, DrizzleMemberRoomReader } from './infrastructure/db/drizzle-attempt-repository.js';
import { DrizzleSessionReader, DrizzleSessionRepository } from './infrastructure/db/drizzle-session-repository.js';
import { bus } from './infrastructure/events/event-bus.js';
import { BusEventPublisher } from './infrastructure/events/bus-event-publisher.js';
import { CryptoRandom } from './infrastructure/system/crypto-random.js';
import { SecureTokenGenerator } from './infrastructure/system/secure-token-generator.js';
import { SystemClock } from './infrastructure/system/system-clock.js';
import type { AttemptUseCases } from './interface/http/attempts-routes.js';
import type { GradingUseCases } from './interface/http/grading-routes.js';
import type { ExamUseCases } from './interface/http/exams-routes.js';
import type { AdminUseCases } from './interface/http/admin-routes.js';
import type { ParticipantUseCases } from './interface/http/participants-routes.js';
import type { SessionUseCases } from './interface/http/sessions-routes.js';
import type { GroupUseCases } from './interface/http/groups-routes.js';

/** Ports every module shares. Tests pass fakes for any of them (see `application/testing`). */
export interface SharedPorts {
  clock: Clock;
  tokens: TokenGenerator;
  random: Random;
  events: EventPublisher;
}

/** Everything the HTTP layer needs from the application. Grows as modules move to Clean Architecture. */
export interface Composition {
  /** Where the SSE route listens for the events use cases publish. */
  eventSource: EventSubscriber;
  exams: ExamUseCases;
  sessions: SessionUseCases;
  groups: GroupUseCases;
  rejoin: RejoinUseCases;
  /** Who is still talking to the server (the mentor's connection column). */
  presence: PresenceTracker;
  participants: ParticipantUseCases;
  attempts: AttemptUseCases;
  grading: GradingUseCases;
  leaderboard: { leaderboard: GetLeaderboard };
  screen: { projectorRoom: GetProjectorRoom; screenSessions: ListScreenSessions };
  /** Members find their session by room code. */
  rooms: { resolve: ResolveRoom };
  /** Resolves a member from a token: backs the `/api/me` hook. */
  resumeParticipant: ResumeParticipant;
  admin: AdminUseCases;
}

// Composition root: the one place that knows which implementation backs each port. Wired by hand.
export function compose(db: Db, overrides: Partial<SharedPorts> = {}): Composition {
  const ports: SharedPorts = {
    clock: new SystemClock(),
    tokens: new SecureTokenGenerator(),
    random: new CryptoRandom(),
    // The same process-wide bus the SSE route subscribes to, so published events reach connected clients.
    events: new BusEventPublisher(bus),
    ...overrides,
  };
  const database = new SqliteDatabase(db);

  const examReader = new DrizzleExamRepository(fn => database.read(fn));
  const examUnitOfWork = new SqliteUnitOfWork<ExamUnitContext>(database, tx => ({
    exams: new DrizzleExamRepository(async fn => fn(tx)),
  }));

  const sessionReader = new DrizzleSessionReader(fn => database.read(fn));
  const groupReader = new DrizzleGroupRepository(fn => database.read(fn));
  const groupUnitOfWork = new SqliteUnitOfWork<GroupUnitContext>(database, tx => ({ groups: new DrizzleGroupRepository(async fn => fn(tx)) }));
  const sessionUnitOfWork = new SqliteUnitOfWork<SessionUnitContext>(database, tx => {
    const access = async <T>(fn: (db: Db) => T) => fn(tx);
    return {
      sessions: new DrizzleSessionRepository(access),
      exams: new DrizzleExamRepository(access),
      groups: new DrizzleGroupRepository(access),
      attempts: new AutoSubmitOpenAttempts({
        attempts: new DrizzleAttemptRepository(access),
        sessions: new DrizzleSessionRepository(access),
        exams: new DrizzleExamRepository(access),
        clock: ports.clock,
      }),
      grading: new CountUngradedEssays({
        attempts: new DrizzleAttemptRepository(access),
        sessions: new DrizzleSessionRepository(access),
        exams: new DrizzleExamRepository(access),
      }),
    };
  });
  const attemptReader = new DrizzleAttemptRepository(fn => database.read(fn));
  const sessionLookup = new DrizzleSessionRepository(fn => database.read(fn));
  const attemptUnitOfWork = new SqliteUnitOfWork<AttemptUnitContext>(database, tx => {
    const access = async <T>(fn: (db: Db) => T) => fn(tx);
    return {
      attempts: new DrizzleAttemptRepository(access),
      sessions: new DrizzleSessionRepository(access),
      participants: new DrizzleParticipantRepository(access),
      exams: new DrizzleExamRepository(access),
    };
  });
  const participantReader = new DrizzleParticipantRepository(fn => database.read(fn));
  const participantUnitOfWork = new SqliteUnitOfWork<ParticipantUnitContext>(database, tx => {
    const access = async <T>(fn: (db: Db) => T) => fn(tx);
    return { sessions: new DrizzleSessionRepository(access), participants: new DrizzleParticipantRepository(access) };
  });
  const presence = new InMemoryPresenceTracker(ports.clock);
  const rejoinReader = new DrizzleRejoinRepository(fn => database.read(fn));
  const rejoinUnitOfWork = new SqliteUnitOfWork<RejoinUnitContext>(database, tx => {
    const access = async <T>(fn: (db: Db) => T) => fn(tx);
    return { sessions: new DrizzleSessionRepository(access), participants: new DrizzleParticipantRepository(access), rejoin: new DrizzleRejoinRepository(access) };
  });
  const rejoinDeps = { unitOfWork: rejoinUnitOfWork, clock: ports.clock, events: ports.events };
  const adminDeps = {
    credentials: new DrizzleAdminCredentialStore(fn => database.read(fn), () => ports.clock.now()),
    sessions: new InMemoryAdminSessionStore(),
    hasher: new ScryptPasswordHasher(),
    tokens: ports.tokens,
  };

  const lifecycle = { unitOfWork: sessionUnitOfWork, sessions: sessionReader, clock: ports.clock, random: ports.random, events: ports.events, modes: defaultSessionModes() };

  const attemptReads = { attempts: attemptReader, sessions: sessionLookup, exams: examReader };

  const gradingReads = { ...attemptReads, participants: participantReader };
  const editDeps = { unitOfWork: attemptUnitOfWork, clock: ports.clock, events: ports.events };

  return {
    eventSource: bus,
    grading: {
      gradingView: new GetGradingView(gradingReads),
      discussionView: new GetDiscussionView(attemptReads),
      gradeAnswer: new GradeAnswer({ unitOfWork: attemptUnitOfWork, clock: ports.clock, events: ports.events }),
    },
    leaderboard: { leaderboard: new GetLeaderboard(gradingReads) },
    screen: { projectorRoom: new GetProjectorRoom(sessionReader), screenSessions: new ListScreenSessions(sessionReader) },
    rooms: { resolve: new ResolveRoom(sessionReader) },
    attempts: {
      start: new StartAttempt({ unitOfWork: attemptUnitOfWork, clock: ports.clock, random: ports.random, events: ports.events }),
      view: new GetAttemptView(attemptReads),
      review: new GetAttemptReview(attemptReads),
      saveAnswer: new SaveAnswer(attemptUnitOfWork),
      submit: new SubmitAttempt({ unitOfWork: attemptUnitOfWork, clock: ports.clock, events: ports.events }),
      memberState: new GetMemberState({ ...attemptReads, rooms: new DrizzleMemberRoomReader(fn => database.read(fn)) }),
      participantReview: new GetParticipantReview({ ...attemptReads, participants: participantReader }),
      requestEdit: new RequestEdit(editDeps),
      finishEdit: new FinishEdit(editDeps),
      resolveEdit: new ResolveEditRequest(editDeps),
    },
    participants: {
      join: new JoinSession({ unitOfWork: participantUnitOfWork, clock: ports.clock, tokens: ports.tokens, events: ports.events }),
      rename: new RenameParticipant({ unitOfWork: participantUnitOfWork, events: ports.events }),
      kick: new KickParticipant({ unitOfWork: participantUnitOfWork, events: ports.events }),
      approve: new ApproveParticipant({ unitOfWork: participantUnitOfWork, events: ports.events }),
      listPublic: new ListPublicParticipants({ sessions: sessionReader, participants: participantReader }),
      rosterCounts: new GetRosterCounts(sessionReader),
    },
    resumeParticipant: new ResumeParticipant(participantReader, presence),
    presence,
    rejoin: {
      request: new RequestRejoin({ ...rejoinDeps, tokens: ports.tokens }),
      status: new GetRejoinStatus({ rejoin: rejoinReader, participants: participantReader, sessions: sessionReader }),
      cancel: new CancelRejoin({ ...rejoinDeps, rejoin: rejoinReader }),
      keep: new ApproveRejoinKeep(rejoinDeps),
      takeover: new ApproveRejoinTakeover(rejoinDeps),
      reject: new RejectRejoin(rejoinDeps),
      allow: new AllowRejoin(rejoinDeps),
    },
    admin: {
      status: new GetAdminStatus(adminDeps),
      setup: new SetupAdmin(adminDeps),
      login: new LoginAdmin(adminDeps),
      logout: new LogoutAdmin(adminDeps.sessions),
      authenticate: new AuthenticateAdmin(adminDeps.sessions),
    },
    groups: {
      list: new ListGroups(groupReader),
      get: new GetGroup(groupReader),
      create: new CreateGroup({ unitOfWork: groupUnitOfWork, groups: groupReader, clock: ports.clock }),
      update: new UpdateGroup({ unitOfWork: groupUnitOfWork, groups: groupReader, clock: ports.clock }),
      remove: new DeleteGroup(groupUnitOfWork),
    },
    sessions: {
      presence,
      create: new CreateSession({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, clock: ports.clock, modes: lifecycle.modes }),
      list: new ListSessions(sessionReader),
      get: new GetSessionDetail(sessionReader),
      open: new OpenSession(lifecycle),
      start: new StartSession(lifecycle),
      close: new CloseSession(lifecycle),
      finalize: new FinalizeSession(lifecycle),
      publicSession: new GetPublicSession(sessionReader),
      addRoster: new AddRosterEmails({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events }),
      saveGroup: new SaveSessionGroup({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events, groups: groupReader, clock: ports.clock }),
    },
    exams: {
      preview: new PreviewExam(),
      importExam: new ImportExam({ unitOfWork: examUnitOfWork, exams: examReader, clock: ports.clock }),
      list: new ListExams(examReader),
      get: new GetExam(examReader),
      remove: new DeleteExam(examUnitOfWork),
    },
  };
}
