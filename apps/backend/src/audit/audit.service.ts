import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { AuditQueryDto } from './audit.dto';

@Injectable()
export class AuditService {
  constructor(
    private prisma: PrismaService,
    private tenants: TenantService,
  ) {}

  async list(user: User, tenantId: string | null, query: AuditQueryDto) {
    const id = await this.tenants.requireConsoleAdmin(user, tenantId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const action = query.action?.trim();
    const where = {
      tenantId: id,
      ...(action ? { action } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, rows };
  }
}
