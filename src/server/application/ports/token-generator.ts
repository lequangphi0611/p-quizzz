/** Makes unguessable tokens (participant tokens). Synchronous: no I/O. Tests use `FakeTokenGenerator`. */
export interface TokenGenerator {
  generate(): string;
}
