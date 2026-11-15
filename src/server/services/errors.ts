// Carries the HTTP status and a Vietnamese message that routes send as `{ error }`.
export class ServiceError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409, message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}
