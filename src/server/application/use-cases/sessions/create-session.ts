import { ExamNotFoundError } from '../../../domain/exam/errors.js';
import type { SessionModeId } from '../../../domain/session/mode.js';
import type { SessionModeRegistry } from '../../../domain/session/mode.js';
import type { Clock } from '../../ports/clock.js';
import type { SessionDetailView, SessionReader, SessionUnitContext } from '../../ports/session-repository.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { SessionNotFoundError } from '../../../domain/session/errors.js';
import { cleanEmails } from '../../../domain/group/emails.js';
import { EmptyEmailListError, GroupNotFoundError } from '../../../domain/group/errors.js';
import type { OutsiderPolicy } from '../../../../shared/api/sessions.js';
import { resolveSessionName } from '../../../domain/session/session-name.js';

export interface CreateSessionInput {
  examId: number;
  /** Mentor-only label; blank or missing gives "<exam title> – dd/MM". */
  name?: string;
  shuffle?: boolean;
  autoApprove?: boolean;
  /** Who may join (PRODUCT.md §7.22). Omitted = free. A roster is COPIED into the session now: editing the group later changes nothing. */
  access?: { kind: 'free' } | { kind: 'group'; groupId: number } | { kind: 'emails'; emails: readonly string[] };
  /** Roster sessions: what happens to someone not on the list (default: turned away). */
  outsiderPolicy?: OutsiderPolicy;
  /** Only `self_paced` exists today; the API does not expose this yet. */
  mode?: SessionModeId;
}

export class CreateSession {
  constructor(
    private readonly deps: { unitOfWork: UnitOfWork<SessionUnitContext>; sessions: SessionReader; clock: Clock; modes: SessionModeRegistry },
  ) {}

  async execute(input: CreateSessionInput): Promise<SessionDetailView> {
    const mode = this.deps.modes.get(input.mode ?? 'self_paced');
    const id = await this.deps.unitOfWork.run(async ctx => {
      const exam = await ctx.exams.findSummary(input.examId);
      if (!exam) throw new ExamNotFoundError();
      const now = this.deps.clock.now();
      let roster: string[] = [];
      let sourceGroupId: number | null = null;
      if (input.access?.kind === 'group') {
        const emails = await ctx.groups.emailsOf(input.access.groupId);
        if (!emails) throw new GroupNotFoundError();
        if (emails.length === 0) throw new EmptyEmailListError();
        roster = emails;
        sourceGroupId = input.access.groupId;
      } else if (input.access?.kind === 'emails') roster = cleanEmails(input.access.emails);
      const isRoster = input.access !== undefined && input.access.kind !== 'free';
      const sessionId = await ctx.sessions.create({
        examId: input.examId,
        name: resolveSessionName(input.name, exam.title, now),
        mode: mode.id,
        shuffle: input.shuffle ?? true,
        // On a roster the list is the mentor's permission: the "auto approve" switch belongs to free sessions only.
        autoApprove: isRoster ? false : input.autoApprove ?? false,
        access: isRoster ? 'roster' : 'free',
        outsiderPolicy: isRoster ? input.outsiderPolicy ?? 'block' : 'block',
        sourceGroupId,
        createdAt: now,
      });
      if (isRoster) await ctx.sessions.addRoster(sessionId, roster);
      return sessionId;
    });
    const detail = await this.deps.sessions.findDetail(id);
    if (!detail) throw new SessionNotFoundError();
    return detail;
  }
}
