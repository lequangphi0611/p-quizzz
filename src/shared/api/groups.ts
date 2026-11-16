import { z } from 'zod';
import type { EmailListParse } from '../email-list.js';

export const MAX_GROUP_NAME_LENGTH = 60;
export const MAX_GROUP_EMAILS = 2000;

// POST /api/admin/groups/preview: parse pasted text without saving anything.
export const PreviewEmailsBody = z.object({
  text: z.string({ error: 'Dán danh sách email' }).max(200_000, 'Danh sách quá dài'),
  defaultDomain: z.string().max(253).optional(),
});
export type EmailListPreview = EmailListParse;

const groupName = z.string({ error: 'Nhập tên nhóm' }).trim().min(1, 'Nhập tên nhóm').max(MAX_GROUP_NAME_LENGTH, `Tên nhóm tối đa ${MAX_GROUP_NAME_LENGTH} ký tự`);

// POST/PUT /api/admin/groups. `emails` may be raw (the server parses and normalizes them again).
export const GroupBody = z.object({
  name: groupName,
  emails: z.array(z.string()).max(MAX_GROUP_EMAILS, `Một nhóm tối đa ${MAX_GROUP_EMAILS} email`),
});

export const SaveGroupBody = z.object({ name: groupName });
export const AddRosterBody = z.object({ emails: z.array(z.string()).min(1, 'Nhập ít nhất một email').max(MAX_GROUP_EMAILS) });

export interface GroupSummary {
  id: number;
  name: string;
  emailCount: number;
  createdAt: number; // epoch ms
  updatedAt: number;
  lastUsedAt: number | null; // when a session was last created from it
}

export interface GroupDetail extends GroupSummary {
  emails: string[]; // mentor only
}
