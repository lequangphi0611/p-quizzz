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
const REVIEW_ROUTE = '/api/me/attempts/:id/review';

export function registerLeakGuard(app: FastifyInstance): void {
  app.addHook('onSend', async (req, reply, payload) => {
    const route = req.routeOptions.url ?? req.url;
    if (route.startsWith('/api/admin')) return payload;
    if (typeof payload !== 'string' || !String(reply.getHeader('content-type') ?? '').includes('application/json')) return payload;
    const leaksKey = route !== REVIEW_ROUTE && KEY.test(payload);
    const leaksEmail = EMAIL_KEY.test(payload);
    if (!leaksKey && !leaksEmail) return payload;

    // Log what leaked where — never the payload itself.
    req.log.error({ route, method: req.method }, leaksEmail ? 'blocked a response carrying an email' : 'blocked a response carrying the answer key');
    const body = JSON.stringify({ error: 'Lỗi máy chủ' });
    reply.code(500).header('content-length', Buffer.byteLength(body));
    return body;
  });
}
