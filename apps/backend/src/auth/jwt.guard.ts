import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export type JwtPayload = {
  sub: string;
  tenantId?: string | null;
  purpose?: string;
  jti?: string;
};

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const cookieName = this.config.get<string>('COOKIE_NAME') ?? 'mammothai_access_token';
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const token = bearer || (req.cookies?.[cookieName] as string | undefined);
    if (!token) throw new UnauthorizedException('未登录');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('登录已过期');
    }

    if (payload.purpose === 'browser-sso') throw new UnauthorizedException('登录已过期');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号不可用');

    (req as Request & { user: typeof user; tenantId: string | null }).user = user;
    (req as Request & { tenantId: string | null }).tenantId = payload.tenantId ?? null;
    return true;
  }
}
