// Compatibility facade for pages that are not migrated yet (epic #7). The implementation lives in
// shared/api-client, shared/token-store and app/composition.ts; new code should not import from here.
import { api, tokenStore } from '../app/composition.js';

export { api };
export { ApiError } from '../shared/api-client/http-client.js';

export const setParticipantToken = (sessionId: number | string, token: string): void => tokenStore.setToken(sessionId, token);
export const getParticipantToken = (sessionId: number | string): string | null => tokenStore.getToken(sessionId);
export const clearParticipantToken = (sessionId: number | string): void => tokenStore.clearToken(sessionId);
export const setCurrentSessionId = (sessionId: number | string): void => tokenStore.setCurrentSessionId(sessionId);
export const getCurrentSessionId = (): string | null => tokenStore.getCurrentSessionId();
