import type { GroupDetail, GroupSummary } from '../../../../shared/api/index.js';

/** Port: the mentor's saved groups of member emails (PRODUCT.md §7.22). Failures reject with `ApiError`. */
export interface GroupsGateway {
  list(): Promise<GroupSummary[]>;
  get(id: number): Promise<GroupDetail>;
  create(input: { name: string; emails: string[] }): Promise<GroupDetail>;
  update(id: number, input: { name: string; emails: string[] }): Promise<GroupDetail>;
  remove(id: number): Promise<void>;
}
