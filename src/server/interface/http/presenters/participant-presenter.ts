import type { SessionParticipantInfo } from '../../../../shared/api/index.js';
import type { Participant } from '../../../domain/participant/participant.js';

// Public shape: never includes the token.
export const toParticipantInfoDto = (p: Participant): SessionParticipantInfo => ({
  id: p.id,
  displayName: p.displayName,
  status: p.status,
  joinedAt: p.joinedAt.getTime(),
});
