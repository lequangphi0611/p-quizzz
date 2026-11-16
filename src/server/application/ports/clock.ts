/** The current time. Synchronous: reading the clock is not I/O. Tests use `FakeClock`. */
export interface Clock {
  now(): Date;
}
