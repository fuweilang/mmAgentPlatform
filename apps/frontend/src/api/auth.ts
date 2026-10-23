import type { SessionMe } from '@mammoth/shared';
import { http } from './http';

export const authApi = {
  login: (phone: string, password: string) =>
    http<SessionMe>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),
  register: (body: { name: string; phone: string; password: string; enterpriseName: string }) =>
    http<SessionMe>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => http<SessionMe>('/api/auth/me'),
  logout: () => http<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  switchTenant: (tenantId: string) =>
    http<SessionMe>('/api/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    }),
};
