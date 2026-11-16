/**
 * Source of randomness for shuffling and room codes. Production uses a cryptographic generator so
 * neither a question order nor a room code can be predicted. Synchronous: no I/O. Tests use `FakeRandom`.
 */
export interface Random {
  /** An integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}
