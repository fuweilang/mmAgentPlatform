import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { AgentModule } from './agent/agent.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { WorkbenchModule } from './workbench/workbench.module';
import { UsageModule } from './usage/usage.module';
import { AuditModule } from './audit/audit.module';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TenantModule,
    AgentModule,
    KnowledgeModule,
    WorkbenchModule,
    UsageModule,
    AuditModule,
    EnterpriseModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
