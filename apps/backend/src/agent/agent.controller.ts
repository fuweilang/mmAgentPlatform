import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentTenantId, CurrentUser } from '../auth/current-user';
import { AgentService } from './agent.service';
import { PatchAgentDto, UpsertAgentDto } from './dto/upsert-agent.dto';

@Controller('agents')
@UseGuards(JwtGuard)
export class AgentController {
  constructor(private agents: AgentService) {}

  @Get()
  list(@CurrentUser() user: User, @CurrentTenantId() tenantId: string | null) {
    return this.agents.list(user, tenantId);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @CurrentTenantId() tenantId: string | null,
    @Body() dto: UpsertAgentDto,
  ) {
    return this.agents.create(user, tenantId, dto);
  }

  @Patch(':id')
  patch(
    @CurrentUser() user: User,
    @CurrentTenantId() tenantId: string | null,
    @Param('id') id: string,
    @Body() dto: PatchAgentDto,
  ) {
    return this.agents.patch(user, tenantId, id, dto);
  }
}
