import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentTenantId, CurrentUser } from '../auth/current-user';
import { TenantService } from './tenant.service';
import { CreateMemberDto } from './dto/create-member.dto';

@Controller('members')
@UseGuards(JwtGuard)
export class MemberController {
  constructor(private tenants: TenantService) {}

  @Get()
  list(@CurrentUser() user: User, @CurrentTenantId() tenantId: string | null) {
    return this.tenants.members(user, tenantId);
  }

  @Post()
  add(
    @CurrentUser() user: User,
    @CurrentTenantId() tenantId: string | null,
    @Body() dto: CreateMemberDto,
  ) {
    return this.tenants.addMember(user, tenantId, dto);
  }
}
