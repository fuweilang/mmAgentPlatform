import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { AccessScope, MemberRole, Prisma, TenantType, User } from '@prisma/client';
import { DEFAULT_AGENT_PERSONA } from '../agent/personas';
import { PrismaService } from '../prisma/prisma.service';
import { SessionMe } from '@mammoth/shared';
import { JwtPayload } from './jwt.guard';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private usedBrowserSsoJti = new Set<string>();

  async register(
    input: { name: string; phone: string; password: string; enterpriseName: string },
    res: Response,
    ip?: string,
  ) {
    const { user, tenant } = await this.createEnterpriseAccount(input);

    this.setCookie(res, { sub: user.id, tenantId: tenant.id });
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: tenant.id, action: 'register', ip },
    });
    return this.me(user, tenant.id);
  }

  async provisionEnterpriseUser(
    actor: User,
    input: { name: string; phone: string; password: string; enterpriseName: string },
  ) {
    if (!actor.isPlatformAdmin) throw new ForbiddenException('仅平台管理员可开户');
    const phone = input.phone.trim();
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      const memberships = await this.prisma.orgMember.findMany({
        where: { userId: existing.id },
        orderBy: { createdAt: 'asc' },
      });
      return {
        id: existing.id,
        phone: existing.phone,
        tenantId: memberships[0]?.tenantId ?? null,
        created: false,
      };
    }
    const { user, tenant } = await this.createEnterpriseAccount(input);
    return { id: user.id, phone: user.phone, tenantId: tenant.id, created: true };
  }

  private async createEnterpriseAccount(input: {
    name: string;
    phone: string;
    password: string;
    enterpriseName: string;
  }) {
    const phone = input.phone.trim();
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) throw new ConflictException('手机号已注册');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const slugBase =
      input.enterpriseName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'org';
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const platform = await this.prisma.tenant.findUnique({ where: { slug: 'platform' } });

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: input.enterpriseName.trim(), slug, type: TenantType.ENTERPRISE },
      });
      if (platform) {
        await tx.orgTree.create({ data: { parentId: platform.id, childId: tenant.id } });
      }
      const user = await tx.user.create({
        data: {
          name: input.name.trim(),
          phone,
          passwordHash,
        },
      });
      await tx.orgMember.create({
        data: { userId: user.id, tenantId: tenant.id, role: MemberRole.OWNER },
      });
      await tx.agentRef.create({
        data: {
          tenantId: tenant.id,
          name: '企业助手',
          persona: DEFAULT_AGENT_PERSONA,
          enabled: true,
          visibility: AccessScope.ALL,
        },
      });
      await tx.quota.create({ data: { tenantId: tenant.id } });
      return { user, tenant };
    });
  }

  async login(phone: string, password: string, res: Response, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号或密码错误');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('账号或密码错误');

    const tenants = await this.listTenants(user);
    const current = user.isPlatformAdmin ? null : tenants[0] ?? null;
    this.setCookie(res, { sub: user.id, tenantId: current?.id ?? null });

    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: current?.id, action: 'login', ip },
    });
    return this.toMe(user, current?.id ?? null, tenants);
  }

  async me(user: User, tenantId: string | null): Promise<SessionMe> {
    const tenants = await this.listTenants(user);
    return this.toMe(user, tenantId, tenants);
  }

  async switchTenant(user: User, tenantId: string, res: Response) {
    const tenants = await this.listTenants(user);
    const target = tenants.find((t) => t.id === tenantId);
    if (!target && !user.isPlatformAdmin) throw new ForbiddenException('无权切换到该租户');
    if (user.isPlatformAdmin && !target) {
      const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!t) throw new ForbiddenException('租户不存在');
    }
    this.setCookie(res, { sub: user.id, tenantId });
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId, action: 'switch_tenant' },
    });
    return this.me(user, tenantId);
  }

  logout(res: Response) {
    res.clearCookie(this.cookieName(), {
      path: '/',
      sameSite: 'lax',
      secure: this.cookieSecure(),
    });
    return { ok: true };
  }

  issueBrowserSsoTicket(user: User, tenantId: string | null) {
    const jti = randomUUID();
    const ticket = this.jwt.sign(
      { sub: user.id, tenantId, purpose: 'browser-sso', jti },
      { expiresIn: '60s' },
    );
    return {
      ticket,
      next: user.isPlatformAdmin ? '/admin' : '/console/',
    };
  }

  async consumeBrowserSso(ticket: string, res: Response) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(ticket);
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    if (payload.purpose !== 'browser-sso' || !payload.jti) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    if (this.usedBrowserSsoJti.has(payload.jti)) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号不可用');
    this.usedBrowserSsoJti.add(payload.jti);
    this.setCookie(res, { sub: user.id, tenantId: payload.tenantId ?? null });
    return this.me(user, payload.tenantId ?? null);
  }

  /** 平台管理员退出代运营：清掉当前企业上下文，回到「没有企业」的平台身份。 */
  async exitWorkbench(user: User, tenantId: string | null, res: Response) {
    if (!user.isPlatformAdmin) throw new ForbiddenException('只有平台管理员可以退出业务工作台');
    this.setCookie(res, { sub: user.id, tenantId: null });
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId, action: 'exit_workbench' },
    });
    return this.me(user, null);
  }

  private cookieName() {
    return this.config.get<string>('COOKIE_NAME') ?? 'mammothai_access_token';
  }

  private cookieSecure() {
    return (this.config.get<string>('PUBLIC_ORIGIN') ?? '').startsWith('https://');
  }

  private setCookie(res: Response, payload: JwtPayload) {
    const token = this.jwt.sign(payload);
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure(),
      path: '/',
      maxAge: 7 * 24 * 3600 * 1000,
    });
  }

  private async listTenants(user: User) {
    if (user.isPlatformAdmin) {
      const all = await this.prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
      const memberships = await this.prisma.orgMember.findMany({ where: { userId: user.id } });
      const roleMap = new Map(memberships.map((m) => [m.tenantId, m.role]));
      return all.map((t) => ({ ...t, role: roleMap.get(t.id) ?? null }));
    }
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId: user.id },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.tenant, role: m.role }));
  }

  private toMe(
    user: User,
    tenantId: string | null,
    tenants: Array<Prisma.TenantGetPayload<object> & { role: MemberRole | null }>,
  ): SessionMe {
    const current = tenants.find((t) => t.id === tenantId) ?? null;
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPlatformAdmin: user.isPlatformAdmin,
      },
      currentTenant: current
        ? { id: current.id, name: current.name, slug: current.slug, type: current.type, status: current.status }
        : null,
      currentRole: current?.role ?? null,
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        type: t.type,
        status: t.status,
        role: t.role,
      })),
    };
  }
}
