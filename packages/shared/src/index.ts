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
