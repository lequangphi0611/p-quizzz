import type { SharedSessionList, SharedSessionView } from '../../../../shared/api/index.js';

/** Port: the share page's data (PRODUCT.md §7.33). Failures reject with `ApiError` (its `code` says which screen to show). */
export interface SharedSessionsGateway {
  list(token: string): Promise<SharedSessionList>;
  get(token: string, sessionId: number): Promise<SharedSessionView>;
}
