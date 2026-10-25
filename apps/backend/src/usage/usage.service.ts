import { ForbiddenException, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { PatchQuotaDto } from './usage.dto';

const DEFAULT_MONTHLY_TURNS = 1000;

@Injectable()
export class UsageService {
  constructor(
    private prisma: PrismaService,
    private tenants: TenantService,
  ) {}

  async quota(user: User, tenantId: string | null) {
    const id = await this.tenants.requireTenant(user, tenantId);
    const quota = await this.ensureQuota(id);
    const usedTurns = await this.monthTurns(id);
    const limit = quota.monthlyTurns;
    const exceeded = limit > 0 && usedTurns >= limit;
    return {
      monthlyTurns: limit,
      monthlyTokens: quota.monthlyTokens,
      usedTurns,
      remainingTurns: limit > 0 ? Math.max(limit - usedTurns, 0) : null,
      exceeded,
      message: exceeded ? '本月对话次数已用完' : undefined,
    };
  }

  async patchQuota(user: User, tenantId: string | null, dto: PatchQuotaDto) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    const current = await this.ensureQuota(id);
    const quota = await this.prisma.quota.update({
      where: { id: current.id },
      data: {
        monthlyTurns: dto.monthlyTurns ?? current.monthlyTurns,
        monthlyTokens: dto.monthlyTokens ?? current.monthlyTokens,
      },
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, tenantId: id, action: 'update_quota', meta: { monthlyTurns: quota.monthlyTurns } },
    });
    return this.quota(user, id);
  }

  async record(user: User, tenantId: string | null, kind: 'chat_turn') {
    const id = await this.tenants.requireTenant(user, tenantId);
    const snapshot = await this.quota(user, id);
    if (snapshot.exceeded) throw new ForbiddenException(snapshot.message || '本月对话次数已用完');
    const event = await this.prisma.usageEvent.create({
      data: { tenantId: id, userId: user.id, kind, quantity: 1 },
    });
    return { id: event.id, ok: true };
  }

  async summary(user: User, tenantId: string | null) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    const snapshot = await this.quota(user, id);
    const start = monthStart();
    const recent = await this.prisma.usageEvent.findMany({
      where: { tenantId: id, createdAt: { gte: start } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, userId: true, kind: true, quantity: true, createdAt: true },
    });
    return { ...snapshot, recent };
  }

  async monthTurnsFor(tenantId: string) {
    return this.monthTurns(tenantId);
  }

  async ensureQuota(tenantId: string) {
    const existing = await this.prisma.quota.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.prisma.quota.create({
      data: { tenantId, monthlyTurns: DEFAULT_MONTHLY_TURNS, monthlyTokens: 0 },
    });
  }

  private monthTurns(tenantId: string) {
    return this.prisma.usageEvent.aggregate({
      where: { tenantId, kind: 'chat_turn', createdAt: { gte: monthStart() } },
      _sum: { quantity: true },
    }).then((row) => row._sum.quantity ?? 0);
  }
}

export function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
