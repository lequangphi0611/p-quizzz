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
import { ClearGrade, GradeAnswer } from './application/use-cases/grading/grade-answer.js';
import { FailUnfinishedSuggestions, RequestAiSuggestions, RunAiSuggestion, StopAiSuggestions } from './application/use-cases/grading/ai-suggestions.js';
import type { GradingUnitContext } from './application/ports/ai-suggestion-repository.js';
import type { EssayGrader } from './application/ports/essay-grader.js';
import { DrizzleAiSuggestionRepository } from './infrastructure/db/drizzle-ai-suggestion-repository.js';
import { ClaudeCliGrader } from './infrastructure/ai-grader/claude-cli-grader.js';
import { InProcessSuggestionQueue } from './infrastructure/ai-grader/suggestion-queue.js';
import { config as appConfig } from './config.js';
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
import { ReleaseScores, SetScoreVisibility } from './application/use-cases/sessions/score-visibility.js';
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
import { CancelCountdown, SetAutoStart, SetStartSchedule, StartCountdown, StartDueSessions } from './application/use-cases/sessions/start-plan.js';
import { SetReady } from './application/use-cases/participants/set-ready.js';
import { CloseExpiredSessions, ExtendTime, SetTimeLimit } from './application/use-cases/sessions/time-limit.js';
import { defaultSessionModes } from './domain/session/mode.js';
import type { Db } from './infrastructure/db/client.js';
import { InMemoryAdminSessionStore } from './infrastructure/auth/in-memory-admin-session-store.js';
import { ScryptPasswordHasher } from './infrastructure/auth/scrypt-password-hasher.js';
import { DrizzleAdminCredentialStore } from './infrastructure/db/drizzle-admin-credential-store.js';
import { DrizzleParticipantRepository } from './infrastructure/db/drizzle-participant-repository.js';
import { DrizzleExamRepository } from './infrastructure/db/drizzle-exam-repository.js';
import { SqliteDatabase, SqliteUnitOfWork } from './infrastructure/db/sqlite-database.js';
import { DrizzleAttemptRepository, DrizzleMemberRoomReader } from './infrastructure/db/drizzle-attempt-repository.js';
import { DrizzleLobbyHeadcount, DrizzleSessionReader, DrizzleSessionRepository } from './infrastructure/db/drizzle-session-repository.js';
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
import type { SharingUseCases } from './interface/http/sharing-routes.js';
import { SetSessionShared } from './application/use-cases/sharing/set-session-shared.js';
import { GetShareLink, RotateShareLink } from './application/use-cases/sharing/share-link.js';
import { GetSharedSession, ListSharedSessions } from './application/use-cases/sharing/shared-sessions.js';
import { DrizzleShareTokenStore } from './infrastructure/db/drizzle-share-token-store.js';
import type { TrainingUnitContext } from './application/ports/training-repository.js';
import { CreateTraining, EndTraining, GetTrainingDetail, ListTrainings, PurgeTrainingMember, RemoveTrainingMember, SaveMemberNote, StopTraining, MarkTrainingEvent } from './application/use-cases/training/admin.js';
import { FinishUninstallCheck, GetHookConfig, GetMyTraining, JoinTraining, ResumeTrainingMember, StartUninstallCheck, WithdrawTrainingConsent } from './application/use-cases/training/member.js';
import { ExportTrainingData, GetTrainingExportSummary } from './application/use-cases/training/export-data.js';
import { DeleteTeachingExample, ExportTeachingExamples, ListTeachingExamples, SaveTeachingExample } from './application/use-cases/training/teaching-examples.js';
import { ExportTrainingReport } from './application/use-cases/training/report.js';
import { NodeZipWriter } from './infrastructure/system/node-zip-writer.js';
import { ResolveAnyRoom } from './application/use-cases/training/resolve-any-room.js';
import { DrizzleTrainingEventRepository } from './infrastructure/db/drizzle-training-event-repository.js';
import { DrizzleTrainingMemberRepository, DrizzleTrainingRepository } from './infrastructure/db/drizzle-training-repository.js';
import { ThrottledTrainingSignals } from './infrastructure/events/throttled-training-signals.js';
import { IngestHookEvent } from './application/use-cases/training/ingest.js';
import { GetTrainingEventDetail, ListMemberEvents } from './application/use-cases/training/view.js';
import { BusTrainingSignals } from './infrastructure/events/bus-training-signals.js';
import type { TrainingUseCases } from './interface/http/training-routes.js';

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
  /** The share page of finished sessions (PRODUCT.md §7.33). */
  sharing: SharingUseCases;
  rejoin: RejoinUseCases;
  /** Who is still talking to the server (the mentor's connection column). */
  presence: PresenceTracker;
  participants: ParticipantUseCases;
  attempts: AttemptUseCases;
  grading: GradingUseCases;
  leaderboard: { leaderboard: GetLeaderboard };
  screen: { projectorRoom: GetProjectorRoom; screenSessions: ListScreenSessions };
  /** Members find their session or training by room code. */
  rooms: { resolve: ResolveAnyRoom; clock: Clock };
  /** AI training sessions (PRODUCT.md §7.34). */
  training: TrainingUseCases;
  /** Resolves a member from a token: backs the `/api/me` hook. */
  resumeParticipant: ResumeParticipant;
  admin: AdminUseCases;
  /** AI grading background work (PRODUCT.md §7.28): fail leftovers at startup; tests wait for the queue to drain. */
  ai: { failUnfinished: FailUnfinishedSuggestions; idle: () => Promise<void> };
}

/** How the AI grader is reached. Tests pass a fake grader (or a fake CLI through `configPath`). */
export interface AiOptions {
  grader?: EssayGrader & { concurrency?: () => Promise<number> };
  configPath?: string;
  onError?: (err: unknown) => void;
}

// Composition root: the one place that knows which implementation backs each port. Wired by hand.
export function compose(db: Db, overrides: Partial<SharedPorts> = {}, aiOptions: AiOptions = {}): Composition {
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
      lobby: new DrizzleLobbyHeadcount(access),
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
  const aiReader = new DrizzleAiSuggestionRepository(fn => database.read(fn));
  const gradingUnitOfWork = new SqliteUnitOfWork<GradingUnitContext>(database, tx => {
    const access = async <T>(fn: (db: Db) => T) => fn(tx);
    return {
      attempts: new DrizzleAttemptRepository(access),
      sessions: new DrizzleSessionRepository(access),
      participants: new DrizzleParticipantRepository(access),
      exams: new DrizzleExamRepository(access),
      aiSuggestions: new DrizzleAiSuggestionRepository(access),
    };
  });
  const grader = aiOptions.grader ?? new ClaudeCliGrader(aiOptions.configPath ?? appConfig.aiGraderConfig);
  const aiDeps = { unitOfWork: gradingUnitOfWork, clock: ports.clock };
  const runAi = new RunAiSuggestion({ ...aiDeps, grader, onError: aiOptions.onError });
  const aiQueue = new InProcessSuggestionQueue(id => runAi.execute(id), grader.concurrency ? () => grader.concurrency!() : undefined);
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

  const trainingReader = new DrizzleTrainingRepository(fn => database.read(fn));
  const trainingMemberReader = new DrizzleTrainingMemberRepository(fn => database.read(fn));
  const trainingEventReader = new DrizzleTrainingEventRepository(fn => database.read(fn));
  const trainingUnitOfWork = new SqliteUnitOfWork<TrainingUnitContext>(database, tx => {
    const access = async <T>(fn: (db: Db) => T) => fn(tx);
    return { trainings: new DrizzleTrainingRepository(access), members: new DrizzleTrainingMemberRepository(access), events: new DrizzleTrainingEventRepository(access) };
  });
  const trainingSignals = new BusTrainingSignals(bus);
  const trainingExportDeps = { trainings: trainingReader, members: trainingMemberReader, events: trainingEventReader, clock: ports.clock, archive: new NodeZipWriter(ports.clock) };
  const trainingDeps = { unitOfWork: trainingUnitOfWork, clock: ports.clock, signals: trainingSignals };
  // Ingest is dense (every prompt and tool call): the mentor's screen is refreshed at most every 2 s per training. Other changes are rare and go out at once.
  const ingestSignals = new ThrottledTrainingSignals(trainingSignals);

  const lifecycle = { unitOfWork: sessionUnitOfWork, sessions: sessionReader, clock: ports.clock, random: ports.random, events: ports.events, modes: defaultSessionModes() };

  const attemptReads = { attempts: attemptReader, sessions: sessionLookup, exams: examReader };

  const gradingReads = { ...attemptReads, participants: participantReader };
  const editDeps = { unitOfWork: attemptUnitOfWork, clock: ports.clock, events: ports.events };
  const shareStore = new DrizzleShareTokenStore(fn => database.read(fn), () => ports.clock.now());
  const shareLinkDeps = { store: shareStore, tokens: ports.tokens, shared: sessionReader };

  return {
    eventSource: bus,
    sharing: {
      setShared: new SetSessionShared({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, clock: ports.clock }),
      link: new GetShareLink(shareLinkDeps),
      rotate: new RotateShareLink(shareLinkDeps),
      list: new ListSharedSessions({ store: shareStore, shared: sessionReader }),
      get: new GetSharedSession({ ...attemptReads, store: shareStore }),
    },
    grading: {
      gradingView: new GetGradingView({ ...gradingReads, aiSuggestions: aiReader, grader }),
      discussionView: new GetDiscussionView(attemptReads),
      gradeAnswer: new GradeAnswer({ unitOfWork: gradingUnitOfWork, clock: ports.clock, events: ports.events }),
      clearGrade: new ClearGrade({ unitOfWork: gradingUnitOfWork, clock: ports.clock, events: ports.events }),
      requestAi: new RequestAiSuggestions({ ...aiDeps, grader, queue: aiQueue }),
      stopAi: new StopAiSuggestions(aiDeps),
    },
    ai: { failUnfinished: new FailUnfinishedSuggestions(aiDeps), idle: () => aiQueue.idle() },
    leaderboard: { leaderboard: new GetLeaderboard(gradingReads) },
    screen: { projectorRoom: new GetProjectorRoom(sessionReader), screenSessions: new ListScreenSessions(sessionReader) },
    rooms: { resolve: new ResolveAnyRoom({ session: new ResolveRoom(sessionReader), trainings: trainingReader }), clock: ports.clock },
    training: {
      create: new CreateTraining({ ...trainingDeps, random: ports.random }),
      list: new ListTrainings(trainingReader),
      detail: new GetTrainingDetail({ trainings: trainingReader, members: trainingMemberReader, events: trainingEventReader }),
      memberEvents: new ListMemberEvents({ trainings: trainingReader, members: trainingMemberReader, events: trainingEventReader }),
      eventDetail: new GetTrainingEventDetail({ trainings: trainingReader, events: trainingEventReader }),
      stop: new StopTraining(trainingDeps),
      end: new EndTraining(trainingDeps),
      removeMember: new RemoveTrainingMember(trainingDeps),
      purgeMember: new PurgeTrainingMember(trainingDeps),
      markEvent: new MarkTrainingEvent(trainingDeps),
      saveNote: new SaveMemberNote(trainingDeps),
      report: new ExportTrainingReport({ ...trainingDeps, trainings: trainingReader, members: trainingMemberReader, events: trainingEventReader }),
      saveTeachingExample: new SaveTeachingExample({ unitOfWork: trainingUnitOfWork, events: trainingEventReader, clock: ports.clock }),
      deleteTeachingExample: new DeleteTeachingExample({ unitOfWork: trainingUnitOfWork }),
      listTeachingExamples: new ListTeachingExamples({ trainings: trainingReader, members: trainingMemberReader, events: trainingEventReader }),
      exportTeachingExamples: new ExportTeachingExamples({ trainings: trainingReader, members: trainingMemberReader, events: trainingEventReader, ...trainingDeps }),
      exportSummary: new GetTrainingExportSummary(trainingExportDeps),
      exportData: new ExportTrainingData(trainingExportDeps),
      join: new JoinTraining({ ...trainingDeps, tokens: ports.tokens }),
      resume: new ResumeTrainingMember({ members: trainingMemberReader, trainings: trainingReader }),
      me: new GetMyTraining(),
      hookConfig: new GetHookConfig(),
      withdraw: new WithdrawTrainingConsent(trainingDeps),
      startUninstallCheck: new StartUninstallCheck(trainingDeps),
      finishUninstallCheck: new FinishUninstallCheck(trainingDeps),
      ingest: new IngestHookEvent({ ...trainingDeps, members: trainingMemberReader, trainings: trainingReader, signals: ingestSignals }),
    },
    attempts: {
      start: new StartAttempt({ unitOfWork: attemptUnitOfWork, clock: ports.clock, random: ports.random, events: ports.events }),
      view: new GetAttemptView(attemptReads),
      review: new GetAttemptReview({ ...attemptReads, aiSuggestions: aiReader }),
      saveAnswer: new SaveAnswer(attemptUnitOfWork, ports.clock),
      submit: new SubmitAttempt({ unitOfWork: attemptUnitOfWork, clock: ports.clock, events: ports.events }),
      memberState: new GetMemberState({ ...attemptReads, rooms: new DrizzleMemberRoomReader(fn => database.read(fn)), clock: ports.clock }),
      participantReview: new GetParticipantReview({ ...attemptReads, participants: participantReader }),
      requestEdit: new RequestEdit(editDeps),
      finishEdit: new FinishEdit(editDeps),
      resolveEdit: new ResolveEditRequest(editDeps),
      setReady: new SetReady({ unitOfWork: participantUnitOfWork, events: ports.events, clock: ports.clock }),
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
      clock: ports.clock,
      create: new CreateSession({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, clock: ports.clock, modes: lifecycle.modes }),
      list: new ListSessions(sessionReader),
      get: new GetSessionDetail(sessionReader),
      open: new OpenSession(lifecycle),
      start: new StartSession(lifecycle),
      close: new CloseSession(lifecycle),
      finalize: new FinalizeSession(lifecycle),
      publicSession: new GetPublicSession(sessionReader),
      addRoster: new AddRosterEmails({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events }),
      setScoreVisibility: new SetScoreVisibility({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events }),
      releaseScores: new ReleaseScores({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events, clock: ports.clock }),
      setTimeLimit: new SetTimeLimit({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events, clock: ports.clock }),
      extendTime: new ExtendTime({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events, clock: ports.clock }),
      closeExpired: new CloseExpiredSessions(lifecycle),
      setStartSchedule: new SetStartSchedule({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events, clock: ports.clock }),
      startCountdown: new StartCountdown({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events, clock: ports.clock }),
      cancelCountdown: new CancelCountdown({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events, clock: ports.clock }),
      setAutoStart: new SetAutoStart({ unitOfWork: sessionUnitOfWork, sessions: sessionReader, events: ports.events, clock: ports.clock }),
      startDue: new StartDueSessions(lifecycle),
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
