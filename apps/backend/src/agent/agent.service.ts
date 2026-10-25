import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessScope, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { PatchAgentDto, UpsertAgentDto } from './dto/upsert-agent.dto';
import { DEFAULT_AGENT_PERSONA } from './personas';

@Injectable()
export class AgentService {
  constructor(
    private prisma: PrismaService,
    private tenants: TenantService,
  ) {}

  async list(user: User, tenantId: string | null) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    const rows = await this.prisma.agentRef.findMany({
      where: { tenantId: id },
      include: { grants: { select: { userId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toRow(row));
  }

  async create(user: User, tenantId: string | null, dto: UpsertAgentDto) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    this.assertSelectedGrants(dto.visibility ?? AccessScope.ALL, dto.userIds);
    const agent = await this.prisma.agentRef.create({
      data: {
        tenantId: id,
        name: dto.name.trim(),
        persona: dto.persona?.trim() || DEFAULT_AGENT_PERSONA,
        enabled: dto.enabled ?? true,
        visibility: dto.visibility ?? AccessScope.ALL,
      },
    });
    await this.replaceGrants(agent.id, agent.visibility, dto.userIds);
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: id, action: 'create_agent', meta: { agentId: agent.id } },
    });
    return this.getOne(id, agent.id);
  }

  async patch(user: User, tenantId: string | null, agentId: string, dto: PatchAgentDto) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    const current = await this.prisma.agentRef.findFirst({ where: { id: agentId, tenantId: id } });
    if (!current) throw new NotFoundException('智能体不存在');
    const visibility = dto.visibility ?? current.visibility;
    if (dto.visibility !== undefined || dto.userIds !== undefined) {
      this.assertSelectedGrants(visibility, dto.userIds ?? (await this.currentGrantIds(agentId)));
    }
    await this.prisma.agentRef.update({
      where: { id: agentId },
      data: {
        name: dto.name?.trim(),
        persona: dto.persona?.trim(),
        enabled: dto.enabled,
        visibility: dto.visibility,
      },
    });
    if (dto.visibility !== undefined || dto.userIds !== undefined) {
      await this.replaceGrants(agentId, visibility, dto.userIds);
    }
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: id, action: 'update_agent', meta: { agentId } },
    });
    return this.getOne(id, agentId);
  }

  private assertSelectedGrants(visibility: AccessScope, userIds?: string[]) {
    if (visibility === AccessScope.SELECTED && (!userIds || userIds.length === 0)) {
      throw new BadRequestException('指定成员时至少选择一人');
    }
  }

  private async currentGrantIds(agentId: string) {
    const grants = await this.prisma.agentGrant.findMany({ where: { agentId }, select: { userId: true } });
    return grants.map((g) => g.userId);
  }

  private async replaceGrants(agentId: string, visibility: AccessScope, userIds?: string[]) {
    await this.prisma.agentGrant.deleteMany({ where: { agentId } });
    if (visibility !== AccessScope.SELECTED || !userIds?.length) return;
    await this.prisma.agentGrant.createMany({
      data: userIds.map((userId) => ({ agentId, userId })),
      skipDuplicates: true,
    });
  }

  private async getOne(tenantId: string, agentId: string) {
    const row = await this.prisma.agentRef.findFirst({
      where: { id: agentId, tenantId },
      include: { grants: { select: { userId: true } } },
    });
    if (!row) throw new NotFoundException('智能体不存在');
    return this.toRow(row);
  }

  private toRow(row: {
    id: string;
    tenantId: string;
    name: string;
    persona: string;
    enabled: boolean;
    visibility: AccessScope;
    createdAt: Date;
    updatedAt: Date;
    grants: Array<{ userId: string }>;
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      persona: row.persona,
      enabled: row.enabled,
      visibility: row.visibility,
      userIds: row.grants.map((g) => g.userId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
