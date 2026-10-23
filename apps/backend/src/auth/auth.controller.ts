import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, SwitchTenantDto } from './dto/login.dto';
import { JwtGuard } from './jwt.guard';
import { CurrentTenantId, CurrentUser } from './current-user';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto.phone, dto.password, res, req.ip);
  }

  @Post('register')
  @HttpCode(200)
  register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.register(dto, res, req.ip);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    return this.auth.logout(res);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUser() user: User, @CurrentTenantId() tenantId: string | null) {
    return this.auth.me(user, tenantId);
  }

  @Post('switch-tenant')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  switchTenant(
    @CurrentUser() user: User,
    @Body() dto: SwitchTenantDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.switchTenant(user, dto.tenantId, res);
  }
}
