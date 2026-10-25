import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { absoluteUploadPath, removeStoredFile, saveTenantLogo } from '../knowledge/storage';
import { PatchEnterpriseDto } from './enterprise.dto';

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class EnterpriseService {
  constructor(
    private prisma: PrismaService,
    private tenants: TenantService,
  ) {}

  async get(user: User, tenantId: string | null) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    return this.toSettings(id);
  }

  async patch(user: User, tenantId: string | null, dto: PatchEnterpriseDto) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    if (dto.defaultAgentId) {
      const agent = await this.prisma.agentRef.findFirst({
        where: { id: dto.defaultAgentId, tenantId: id },
      });
      if (!agent) throw new BadRequestException('默认智能体不存在');
    }
    await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        welcomeMessage: dto.welcomeMessage,
        defaultAgentId: dto.defaultAgentId === undefined ? undefined : dto.defaultAgentId || null,
      },
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: id, action: 'update_enterprise', meta: { fields: Object.keys(dto) } },
    });
    return this.toSettings(id);
  }

  async uploadLogo(user: User, tenantId: string | null, file: UploadedFile | undefined) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    if (!file) throw new BadRequestException('请选择图片');
    const current = await this.prisma.tenant.findUnique({ where: { id } });
    let storagePath: string;
    try {
      storagePath = await saveTenantLogo(id, file.originalname, file.buffer);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : '上传失败');
    }
    await this.prisma.tenant.update({
      where: { id },
      data: { logoUrl: storagePath },
    });
    if (current?.logoUrl) await removeStoredFile(current.logoUrl);
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: id, action: 'update_enterprise_logo' },
    });
    return this.toSettings(id);
  }

  async logoFile(user: User, tenantId: string | null) {
    const id = await this.tenants.requireTenant(user, tenantId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant?.logoUrl) throw new NotFoundException('尚未上传 Logo');
    const abs = absoluteUploadPath(tenant.logoUrl);
    if (!existsSync(abs)) throw new NotFoundException('文件已丢失');
    return { abs, name: tenant.logoUrl.split('/').pop() || 'logo', mime: guessMime(tenant.logoUrl) };
  }

  private async toSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('企业不存在');
    const agents = await this.prisma.agentRef.findMany({
      where: { tenantId },
      select: { id: true, name: true, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl ? `/console/api/enterprise/logo` : null,
      welcomeMessage: tenant.welcomeMessage,
      defaultAgentId: tenant.defaultAgentId,
      agents,
    };
  }
}

function guessMime(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}
