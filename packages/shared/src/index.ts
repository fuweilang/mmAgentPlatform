export const APP_NAME = '猛犸智能体';

export const TenantType = {
  PLATFORM: 'PLATFORM',
  AGENCY: 'AGENCY',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type TenantType = (typeof TenantType)[keyof typeof TenantType];

export const MemberRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const TenantTypeLabel: Record<TenantType, string> = {
  PLATFORM: '总部',
  AGENCY: '代理商',
  ENTERPRISE: '企业',
};

export const MemberRoleLabel: Record<MemberRole, string> = {
  OWNER: '负责人',
  ADMIN: '管理员',
  MEMBER: '成员',
};

export const AccessScope = {
  ALL: 'ALL',
  SELECTED: 'SELECTED',
} as const;
export type AccessScope = (typeof AccessScope)[keyof typeof AccessScope];

export const AccessScopeLabel: Record<AccessScope, string> = {
  ALL: '全员',
  SELECTED: '指定成员',
};

export const KbStatus = {
  PENDING: 'PENDING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type KbStatus = (typeof KbStatus)[keyof typeof KbStatus];

export const KbStatusLabel: Record<KbStatus, string> = {
  PENDING: '待生效',
  READY: '已生效',
  FAILED: '失败',
};

export const AuditActionLabel: Record<string, string> = {
  login: '登录',
  register: '注册',
  switch_tenant: '切换企业',
  exit_workbench: '退出业务工作台',
  create_tenant: '创建租户',
  add_member: '添加成员',
  create_agent: '创建智能体',
  update_agent: '更新智能体',
  create_kb_folder: '新建知识目录',
  upload_kb: '上传知识文件',
  update_kb: '更新知识文件',
  delete_kb: '删除知识文件',
  update_quota: '更新配额',
  update_enterprise: '更新企业设置',
  update_enterprise_logo: '更新企业 Logo',
};

export function canAccessConsole(session: SessionMe | null | undefined): boolean {
  if (!session) return false;
  if (session.user.isPlatformAdmin) return true;
  return session.currentRole === MemberRole.OWNER || session.currentRole === MemberRole.ADMIN;
}

export type PublicUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isPlatformAdmin: boolean;
};

export type PublicTenant = {
  id: string;
  name: string;
  slug: string;
  type: TenantType;
  status: string;
};

export type SessionMe = {
  user: PublicUser;
  currentTenant: PublicTenant | null;
  currentRole: MemberRole | null;
  tenants: Array<PublicTenant & { role: MemberRole | null }>;
};
