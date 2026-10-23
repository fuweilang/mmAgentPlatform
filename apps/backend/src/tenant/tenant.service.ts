import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { MemberRole, TenantType, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateMemberDto } from './dto/create-member.dto';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async list(user: User) {
    if (user.isPlatformAdmin) {
      return this.prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
    }
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId: user.id },
      include: { tenant: true },
    });
    return memberships.map((m) => m.tenant);
  }

  async create(user: User, dto: CreateTenantDto) {
    if (dto.type === TenantType.PLATFORM) {
      throw new BadRequestException('总部租户不可再创建');
    }
    if (!user.isPlatformAdmin) {
      const parentId = dto.parentId;
      if (!parentId) throw new ForbiddenException('无权创建租户');
      const membership = await this.prisma.orgMember.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId: parentId } },
      });
      if (!membership || (membership.role !== MemberRole.OWNER && membership.role !== MemberRole.ADMIN)) {
        throw new ForbiddenException('无权在该组织下创建');
      }
      if (dto.type !== TenantType.ENTERPRISE) {
        throw new ForbiddenException('代理商只能创建企业');
      }
    }
    const tenant = await this.prisma.tenant.create({
      data: { name: dto.name, slug: dto.slug, type: dto.type },
    });
    if (dto.parentId) {
      const parent = await this.prisma.tenant.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('上级组织不存在');
      await this.prisma.orgTree.create({ data: { parentId: parent.id, childId: tenant.id } });
    }
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: tenant.id, action: 'create_tenant', meta: { slug: dto.slug } },
    });
    return tenant;
  }

  async members(user: User, tenantId: string | null) {
    const id = await this.requireTenant(user, tenantId);
    return this.prisma.orgMember.findMany({
      where: { tenantId: id },
      include: { user: { select: { id: true, name: true, email: true, phone: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(actor: User, tenantId: string | null, dto: CreateMemberDto) {
    const id = await this.requireTenant(actor, tenantId, true);
    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          passwordHash: await bcrypt.hash(dto.password, 10),
        },
      });
    }

    const existing = await this.prisma.orgMember.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: id } },
    });
    if (existing) throw new BadRequestException('该用户已在本租户');

    const member = await this.prisma.orgMember.create({
      data: { userId: user.id, tenantId: id, role: dto.role },
      include: { user: { select: { id: true, name: true, email: true, phone: true, status: true } } },
    });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, tenantId: id, action: 'add_member', meta: { memberUserId: user.id } },
    });
    return member;
  }

  private async requireTenant(user: User, tenantId: string | null, write = false) {
    if (!tenantId) throw new BadRequestException('请先选择租户');
    if (user.isPlatformAdmin) {
      const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!t) throw new NotFoundException('租户不存在');
      return tenantId;
    }
    const membership = await this.prisma.orgMember.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });
    if (!membership) throw new ForbiddenException('无权访问该租户');
    if (write && membership.role === MemberRole.MEMBER) {
      throw new ForbiddenException('成员不能添加员工');
    }
    return tenantId;
  }
}
