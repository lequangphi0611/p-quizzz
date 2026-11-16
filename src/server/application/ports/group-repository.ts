/** A saved list of member emails (PRODUCT.md §7.22). Read model for the mentor's group screens. */
export interface GroupSummaryView {
  id: number;
  name: string;
  emailCount: number;
  createdAt: Date;
  updatedAt: Date;
  /** When a session was last created from this group. */
  lastUsedAt: Date | null;
}

export interface GroupDetailView extends GroupSummaryView {
  emails: string[];
}

/** Write side: only reachable inside a unit of work. Emails are already normalized and de-duplicated. */
export interface GroupRepository {
  create(input: { name: string; emails: string[]; now: Date }): Promise<number>;
  /** False when the group does not exist. */
  replace(id: number, input: { name: string; emails: string[]; now: Date }): Promise<boolean>;
  /** False when the group does not exist. Sessions created from it keep their own copy of the list. */
  remove(id: number): Promise<boolean>;
  /** The group's emails in the order typed, or null when it does not exist. */
  emailsOf(id: number): Promise<string[] | null>;
  /** All group names, to keep them unique (case-insensitive, compared in the domain). */
  names(): Promise<{ id: number; name: string }[]>;
}

export interface GroupReader {
  list(): Promise<GroupSummaryView[]>;
  find(id: number): Promise<GroupDetailView | null>;
}

export interface GroupUnitContext {
  groups: GroupRepository;
}
