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
import { MemberRole, Prisma, TenantType, User } from '@prisma/client';
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

  async register(
    input: { name: string; phone: string; password: string; enterpriseName: string },
    res: Response,
    ip?: string,
  ) {
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

    const { user, tenant } = await this.prisma.$transaction(async (tx) => {
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
      return { user, tenant };
    });

    this.setCookie(res, { sub: user.id, tenantId: tenant.id });
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: tenant.id, action: 'register', ip },
    });
    return this.me(user, tenant.id);
  }

  async login(phone: string, password: string, res: Response, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号或密码错误');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('账号或密码错误');

    const tenants = await this.listTenants(user);
    const current = tenants[0] ?? null;
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
    res.clearCookie(this.cookieName(), { path: '/' });
    return { ok: true };
  }

  private cookieName() {
    return this.config.get<string>('COOKIE_NAME') ?? 'mammothai_access_token';
  }

  private setCookie(res: Response, payload: JwtPayload) {
    const token = this.jwt.sign(payload);
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
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
