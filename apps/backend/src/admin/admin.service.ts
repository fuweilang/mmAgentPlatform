import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { MemberRole, Prisma, TenantType, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { ListAdminUsersDto } from './dto/list-admin-users.dto';
import { CreateAdminEnterpriseDto } from './dto/create-admin-enterprise.dto';
import { UpdateAdminEnterpriseDto } from './dto/update-admin-enterprise.dto';

const userSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  isPlatformAdmin: true,
  status: true,
  createdAt: true,
  memberships: {
    select: { role: true, tenant: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.UserSelect;

const enterpriseSelect = {
  id: true,
  name: true,
  slug: true,
  type: true,
  status: true,
  createdAt: true,
  _count: { select: { members: true } },
} satisfies Prisma.TenantSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type EnterpriseRow = Prisma.TenantGetPayload<{ select: typeof enterpriseSelect }>;

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private requirePlatformAdmin(actor: User) {
    if (!actor.isPlatformAdmin) throw new ForbiddenException('仅平台管理员可访问总后台');
  }

  private presentUser(user: UserRow) {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      status: user.status,
      createdAt: user.createdAt,
      tenants: user.memberships.map((m) => ({ id: m.tenant.id, name: m.tenant.name, role: m.role })),
    };
  }

  private presentEnterprise(tenant: EnterpriseRow) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      type: tenant.type,
      status: tenant.status,
      createdAt: tenant.createdAt,
      memberCount: tenant._count.members,
    };
  }

  private async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('用户不存在');
    return this.presentUser(user);
  }

  private async getEnterprise(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: enterpriseSelect });
    if (!tenant) throw new NotFoundException('企业不存在');
    return this.presentEnterprise(tenant);
  }

  async listUsers(actor: User, query: ListAdminUsersDto) {
    this.requirePlatformAdmin(actor);
    const where: Prisma.UserWhereInput = {};
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword } },
      ];
    }
    if (query.role === 'admin') where.isPlatformAdmin = true;
    else if (query.role === 'user') where.isPlatformAdmin = false;
    if (query.status) where.status = query.status;

    const users = await this.prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => this.presentUser(user));
  }

  async createUser(actor: User, dto: CreateAdminUserDto) {
    this.requirePlatformAdmin(actor);
    const phone = dto.phone.trim();
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) throw new ConflictException('手机号已存在');

    const tenantId = dto.tenantId ?? null;
    if (!dto.isPlatformAdmin && !tenantId) {
      throw new BadRequestException('普通用户必须绑定一家企业');
    }
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException('企业不存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name.trim(),
          phone,
          passwordHash,
          isPlatformAdmin: dto.isPlatformAdmin,
        },
      });
      if (tenantId) {
        await tx.orgMember.create({
          data: { userId: created.id, tenantId, role: MemberRole.MEMBER },
        });
      }
      return created;
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        tenantId,
        action: 'admin_create_user',
        meta: { targetUserId: user.id, isPlatformAdmin: dto.isPlatformAdmin },
      },
    });
    return this.getUser(user.id);
  }

  async updateUser(actor: User, id: string, dto: UpdateAdminUserDto) {
    this.requirePlatformAdmin(actor);
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');

    const demoting = dto.isPlatformAdmin === false;
    const deactivating = dto.status !== undefined && dto.status !== 'active';
    // 防自锁：把自己降级/停用后就没有人能再进总后台管理用户。
    if (actor.id === id && demoting) throw new BadRequestException('不能取消自己的平台管理员身份');
    if (actor.id === id && deactivating) throw new BadRequestException('不能停用自己');
    // 防锁死：扣掉目标后仍要有 ≥1 名可用平台管理员（目标本就 inactive 时计数不含它，不误伤）。
    if (existing.isPlatformAdmin && (demoting || deactivating)) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: { isPlatformAdmin: true, status: 'active', id: { not: id } },
      });
      if (otherActiveAdmins < 1) {
        throw new BadRequestException('需保留至少一名可用状态的平台管理员，请先增配其他管理员');
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.isPlatformAdmin !== undefined) data.isPlatformAdmin = dto.isPlatformAdmin;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id }, data });
    }
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'admin_update_user', meta: { targetUserId: id } },
    });
    return this.getUser(id);
  }

  async deactivateUser(actor: User, id: string) {
    this.requirePlatformAdmin(actor);
    if (actor.id === id) throw new BadRequestException('不能停用自己');
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');

    await this.prisma.user.update({ where: { id }, data: { status: 'inactive' } });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'admin_deactivate_user', meta: { targetUserId: id } },
    });
    return this.getUser(id);
  }

  async deleteUser(actor: User, id: string) {
    this.requirePlatformAdmin(actor);
    if (actor.id === id) throw new BadRequestException('不能删除自己');
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('用户不存在');
    if (existing.isPlatformAdmin) throw new BadRequestException('平台管理员不能删除');

    await this.prisma.user.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'admin_delete_user',
        meta: { targetUserId: id, name: existing.name, phone: existing.phone },
      },
    });
    return { ok: true };
  }

  async listEnterprises(actor: User) {
    this.requirePlatformAdmin(actor);
    const tenants = await this.prisma.tenant.findMany({
      select: enterpriseSelect,
      orderBy: { createdAt: 'asc' },
    });
    return tenants.map((tenant) => this.presentEnterprise(tenant));
  }

  async createEnterprise(actor: User, dto: CreateAdminEnterpriseDto) {
    this.requirePlatformAdmin(actor);
    const slug = dto.slug.trim();
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('品牌已存在');

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name.trim(),
        slug,
        type: TenantType.ENTERPRISE,
        status: dto.status ?? 'active',
        quota: { create: {} },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        tenantId: tenant.id,
        action: 'admin_create_enterprise',
        meta: { slug },
      },
    });
    return this.getEnterprise(tenant.id);
  }

  async updateEnterprise(actor: User, id: string, dto: UpdateAdminEnterpriseDto) {
    this.requirePlatformAdmin(actor);
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('企业不存在');

    const data: Prisma.TenantUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.slug !== undefined && dto.slug.trim() !== existing.slug) {
      const slug = dto.slug.trim();
      const dup = await this.prisma.tenant.findUnique({ where: { slug } });
      if (dup) throw new ConflictException('品牌已存在');
      data.slug = slug;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.tenant.update({ where: { id }, data });
    }
    await this.prisma.auditLog.create({
      data: { userId: actor.id, tenantId: id, action: 'admin_update_enterprise' },
    });
    return this.getEnterprise(id);
  }

  async deleteEnterprise(actor: User, id: string) {
    this.requirePlatformAdmin(actor);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        agents: { select: { name: true } },
        _count: {
          select: {
            children: true,
            kbFolders: true,
            kbDocuments: true,
            usageEvents: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('企业不存在');
    if (tenant.type === TenantType.PLATFORM) throw new BadRequestException('总部不可删除');
    if (this.hasEnterpriseBusinessData(tenant)) {
      throw new BadRequestException('有数据，不能删除');
    }

    const members = await this.prisma.orgMember.findMany({
      where: { tenantId: id },
      select: {
        user: {
          select: {
            id: true,
            isPlatformAdmin: true,
            memberships: { select: { tenantId: true } },
          },
        },
      },
    });
    const removableUserIds = members
      .map((member) => member.user)
      .filter((user) =>
        user.id !== actor.id
        && !user.isPlatformAdmin
        && user.memberships.length === 1,
      )
      .map((user) => user.id);

    await this.prisma.$transaction(async (tx) => {
      if (removableUserIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: removableUserIds } } });
      }
      await tx.tenant.delete({ where: { id } });
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'admin_delete_enterprise',
        meta: { slug: tenant.slug, deletedUserIds: removableUserIds },
      },
    });
    return { ok: true };
  }

  private hasEnterpriseBusinessData(tenant: {
    agents: Array<{ name: string }>;
    _count: {
      children: number;
      kbFolders: number;
      kbDocuments: number;
      usageEvents: number;
    };
  }) {
    const customAgents = tenant.agents.filter((agent) => agent.name !== '企业助手');
    return tenant._count.children > 0
      || customAgents.length > 0
      || tenant._count.kbFolders > 0
      || tenant._count.kbDocuments > 0
      || tenant._count.usageEvents > 0;
  }
}