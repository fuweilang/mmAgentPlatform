import type { MemberRole, PublicTenant, TenantType } from '@mammoth/shared';
import { http } from './http';

export type TenantRow = PublicTenant;

export type MemberRow = {
  id: string;
  role: MemberRole;
  createdAt: string;
  user: { id: string; name: string; email: string | null; phone: string | null; status: string };
};

export const tenantApi = {
  list: () => http<TenantRow[]>('/api/tenants'),
  create: (body: { name: string; slug: string; type: TenantType; parentId?: string }) =>
    http<TenantRow>('/api/tenants', { method: 'POST', body: JSON.stringify(body) }),
  members: () => http<MemberRow[]>('/api/members'),
  addMember: (body: { name: string; phone: string; password: string; role: MemberRole }) =>
    http<MemberRow>('/api/members', { method: 'POST', body: JSON.stringify(body) }),
};
