/** Parses a numeric `:id` path param; null when it is not a positive integer. */
export const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};
