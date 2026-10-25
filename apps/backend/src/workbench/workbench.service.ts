import { Injectable } from '@nestjs/common';
import { KbStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class WorkbenchService {
  constructor(
    private prisma: PrismaService,
    private tenants: TenantService,
  ) {}

  async summary(user: User, tenantId: string | null) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const [
      memberCount,
      agentCount,
      agentEnabledCount,
      kbDocumentCount,
      kbPendingCount,
      kbReadyCount,
      quota,
      usedTurns,
    ] = await Promise.all([
      this.prisma.orgMember.count({ where: { tenantId: id } }),
      this.prisma.agentRef.count({ where: { tenantId: id } }),
      this.prisma.agentRef.count({ where: { tenantId: id, enabled: true } }),
      this.prisma.kbDocument.count({ where: { tenantId: id } }),
      this.prisma.kbDocument.count({ where: { tenantId: id, status: KbStatus.PENDING } }),
      this.prisma.kbDocument.count({ where: { tenantId: id, status: KbStatus.READY } }),
      this.prisma.quota.findUnique({ where: { tenantId: id } }),
      this.prisma.usageEvent.aggregate({
        where: { tenantId: id, kind: 'chat_turn', createdAt: { gte: start } },
        _sum: { quantity: true },
      }),
    ]);
    const monthlyTurns = quota?.monthlyTurns ?? 1000;
    const used = usedTurns._sum.quantity ?? 0;
    return {
      tenantName: tenant?.name ?? '',
      welcomeMessage: tenant?.welcomeMessage ?? '',
      logoUrl: tenant?.logoUrl ? '/console/api/enterprise/logo' : null,
      memberCount,
      agentCount,
      agentEnabledCount,
      kbDocumentCount,
      kbPendingCount,
      kbReadyCount,
      usedTurns: used,
      monthlyTurns,
    };
  }
}
