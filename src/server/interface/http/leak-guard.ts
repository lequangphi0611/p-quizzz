import type { FastifyInstance } from 'fastify';

// Safety net behind the "answers never reach a member before the session closes" rule
// (docs/architecture.md §5). The rule is enforced by building member DTOs field by field; this hook catches the
// day someone returns a database row by mistake: any JSON response carrying the answer key is replaced by a 500.
//
// Exempt: /api/admin/* (mentor machine only, needs the mentor cookie) and the review route, which is the one
// member endpoint that may carry the key — and refuses (403) until the session has closed.
const KEY = /"(isCorrect|is_correct|explanation)"\s*:/;
// A member's email is mentor-only data (PRODUCT.md §7.24): no response outside /api/admin may carry one, review route included.
const EMAIL_KEY = /"(email|emails)"\s*:/;
// AI grading suggestions are mentor-only (PRODUCT.md §7.28f), review route included.
const AI_KEY = /"aiSuggestion"\s*:/;
// The class's reasons on `{reason}` questions are mentor-only (PRODUCT.md §7.32e); a member only ever gets their own `reasonText`.
const REASONS_KEY = /"reasons"\s*:/;
// What an AI training collected (PRODUCT.md §7.34) is mentor-only: nothing under the member's /api/training* routes may carry it,
// and the token that sits in the hook config on a member's machine never travels as a field (it appears only as a header value).
const TRAINING_ROUTE = /^\/api\/trainings?\//;
const TRAINING_KEY = /"(prompt|toolTarget|summary|output|change|events)"\s*:/;
const INGEST_TOKEN_KEY = /"ingestToken"\s*:/;
const REVIEW_ROUTE = '/api/me/attempts/:id/review';
// The share page (PRODUCT.md §7.33) carries the key and explanations on purpose, and must never carry anything about one
// person: no name, answer, reason, feedback or score. Nor the mentor-only fields of a session row (room code, slot, access,
// source group), so spreading a session into the DTO later cannot slip through.
const SHARED_ROUTES = new Set(['/api/shared/:token/sessions', '/api/shared/:token/sessions/:id']);
const PERSONAL_KEY = /"(displayName|name|participant|participants|participantId|attemptId|answerId|selectedOptionIds|textAnswer|reasonText|feedback|score|autoScore|manualScore|label|roomCode|slot|access|sourceGroupId)"\s*:/;

export function registerLeakGuard(app: FastifyInstance): void {
  app.addHook('onSend', async (req, reply, payload) => {
    const route = req.routeOptions.url ?? req.url;
    if (route.startsWith('/api/admin')) return payload;
    if (typeof payload !== 'string' || !String(reply.getHeader('content-type') ?? '').includes('application/json')) return payload;
    const shared = SHARED_ROUTES.has(route);
    const leaksKey = route !== REVIEW_ROUTE && !shared && KEY.test(payload);
    const leaksPersonal = shared && PERSONAL_KEY.test(payload);
    const leaksEmail = EMAIL_KEY.test(payload);
    const leaksAi = AI_KEY.test(payload);
    const leaksReasons = REASONS_KEY.test(payload);
    const leaksTraining = (TRAINING_ROUTE.test(route) && TRAINING_KEY.test(payload)) || INGEST_TOKEN_KEY.test(payload);
    if (!leaksKey && !leaksEmail && !leaksAi && !leaksReasons && !leaksPersonal && !leaksTraining) return payload;

    // Log what leaked where — never the payload itself.
    req.log.error({ route, method: req.method }, leaksTraining ? 'blocked a response carrying AI training data' : leaksEmail ? 'blocked a response carrying an email' : leaksPersonal ? 'blocked a share-page response carrying personal data' : leaksAi ? 'blocked a response carrying an AI suggestion' : leaksReasons ? "blocked a response carrying the class's reasons" : 'blocked a response carrying the answer key');
    const body = JSON.stringify({ error: 'Lỗi máy chủ' });
    reply.code(500).header('content-length', Buffer.byteLength(body));
    return body;
  });
}
