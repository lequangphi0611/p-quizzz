/** Where the share page's token lives (PRODUCT.md §7.33b). One token for the whole page. */
export interface ShareTokenStore {
  get(): Promise<string | null>;
  /** Stores `candidate` unless a token exists already; returns the token now in force. */
  getOrCreate(candidate: string): Promise<string>;
  /** "Đổi link": the old token stops working at once. */
  replace(token: string): Promise<void>;
}

export interface SharedSessionRow {
  id: number;
  examTitle: string;
  startedAt: Date | null;
  questionCount: number;
}

export interface SharedSessionReader {
  /** Sessions on the share page (shared and ended), newest start first. Never the mentor's session name. */
  listShared(): Promise<SharedSessionRow[]>;
}
