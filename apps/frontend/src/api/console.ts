import type { AccessScope, KbStatus } from '@mammoth/shared';
import { apiUrl, http } from './http';

export type WorkbenchSummary = {
  tenantName: string;
  welcomeMessage: string;
  logoUrl: string | null;
  memberCount: number;
  agentCount: number;
  agentEnabledCount: number;
  kbDocumentCount: number;
  kbPendingCount: number;
  kbReadyCount: number;
  usedTurns: number;
  monthlyTurns: number;
};

export type AgentRow = {
  id: string;
  tenantId: string;
  name: string;
  persona: string;
  enabled: boolean;
  visibility: AccessScope;
  userIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type KbFolderRow = {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
};

export type KbDocumentRow = {
  id: string;
  tenantId: string;
  folderId: string | null;
  folderName: string | null;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: KbStatus;
  visibility: AccessScope;
  userIds: string[];
  createdAt: string;
};

export type AgentPayload = {
  name: string;
  persona?: string;
  enabled?: boolean;
  visibility?: AccessScope;
  userIds?: string[];
};

export const workbenchApi = {
  summary: () => http<WorkbenchSummary>('/api/workbench'),
};

export const agentApi = {
  list: () => http<AgentRow[]>('/api/agents'),
  create: (body: AgentPayload) => http<AgentRow>('/api/agents', { method: 'POST', body: JSON.stringify(body) }),
  patch: (id: string, body: Partial<AgentPayload>) =>
    http<AgentRow>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const knowledgeApi = {
  folders: () => http<KbFolderRow[]>('/api/kb/folders'),
  createFolder: (name: string) =>
    http<KbFolderRow>('/api/kb/folders', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteFolder: (id: string) => http<{ ok: boolean }>(`/api/kb/folders/${id}`, { method: 'DELETE' }),
  documents: (folderId?: string) => {
    const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
    return http<KbDocumentRow[]>(`/api/kb/documents${query}`);
  },
  upload: (form: FormData) => http<KbDocumentRow>('/api/kb/documents', { method: 'POST', body: form }),
  patch: (
    id: string,
    body: Partial<{
      name: string;
      folderId: string | null;
      status: KbStatus;
      visibility: AccessScope;
      userIds: string[];
    }>,
  ) => http<KbDocumentRow>(`/api/kb/documents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => http<{ ok: boolean }>(`/api/kb/documents/${id}`, { method: 'DELETE' }),
  search: (q: string) => http<{ tenantId: string; hits: KbHit[] }>(`/api/kb/search?q=${encodeURIComponent(q)}`),
};

/** 知识库文件下载地址：浏览器新开窗口直接下载，前缀改写与 http() 同源（apiUrl）。 */
export function kbDownloadUrl(id: string) {
  return apiUrl(`/api/kb/documents/${id}/file`);
}

export type KbHit = {
  documentId: string;
  documentName: string;
  folderName: string | null;
  snippet: string;
  score: number;
};

export type QuotaSnapshot = {
  monthlyTurns: number;
  monthlyTokens: number;
  usedTurns: number;
  remainingTurns: number | null;
  exceeded: boolean;
  message?: string;
  recent?: Array<{
    id: string;
    userId: string | null;
    kind: string;
    quantity: number;
    createdAt: string;
  }>;
};

export type AuditRow = {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  ip: string | null;
  meta: unknown;
  createdAt: string;
};

export type EnterpriseSettings = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  welcomeMessage: string;
  defaultAgentId: string | null;
  agents: Array<{ id: string; name: string; enabled: boolean }>;
};

export const usageApi = {
  quota: () => http<QuotaSnapshot>('/api/usage/quota'),
  summary: () => http<QuotaSnapshot>('/api/usage/summary'),
  patchQuota: (body: { monthlyTurns?: number; monthlyTokens?: number }) =>
    http<QuotaSnapshot>('/api/usage/quota', { method: 'PATCH', body: JSON.stringify(body) }),
};

export const auditApi = {
  list: (page = 1, action = '') => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (action) params.set('action', action);
    return http<{ total: number; page: number; pageSize: number; rows: AuditRow[] }>(`/api/audit?${params}`);
  },
};

export const enterpriseApi = {
  get: () => http<EnterpriseSettings>('/api/enterprise'),
  patch: (body: { name?: string; welcomeMessage?: string; defaultAgentId?: string | null }) =>
    http<EnterpriseSettings>('/api/enterprise', { method: 'PATCH', body: JSON.stringify(body) }),
  uploadLogo: (form: FormData) => http<EnterpriseSettings>('/api/enterprise/logo', { method: 'POST', body: form }),
};
