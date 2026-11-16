import { createHttpClient } from '../shared/api-client/http-client.js';
import { participantAuth } from '../shared/api-client/participant-auth.js';
import { createSessionEventHub } from '../shared/events/sse-event-stream.js';
import { LocalStorageTokenStore } from '../shared/token-store/local-storage-token-store.js';

/**
 * Web composition root: the one place that picks implementations for the ports.
 *
 * Module-level singletons, not React context, on purpose: (1) the SSE hub must be one per tab (browsers allow
 * ~6 HTTP/1.1 connections per origin), which is a process-wide fact, not a tree-scoped one; (2) code that is not yet
 * migrated (pages/, lib/) imports these straight from here without a provider above it. Features receive them as
 * ports through their own gateways/hooks, and tests build their own with the in-memory fakes.
 */
export const tokenStore = new LocalStorageTokenStore();
export const api = createHttpClient({ interceptors: [participantAuth(tokenStore)] });
export const eventStream = createSessionEventHub();
