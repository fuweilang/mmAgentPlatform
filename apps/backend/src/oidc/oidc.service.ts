import { createHash, randomBytes } from 'crypto';
import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignJWT, createLocalJWKSet, jwtVerify } from 'jose';
import type { JWK, JWTPayload } from 'jose';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { loadOidcKeys, OIDC_KID } from './oidc.keys';
import { saveCode, takeCode } from './oidc.store';

const CLIENT_ID = 'mammoth-octop';
const PUBLIC_API_HEADER = 'x-mammoth-public-api';
const DEFAULT_ISSUER = 'http://127.0.0.1:5201/console/api/oidc';

type RequestLike = {
  headers?: Record<string, unknown>;
  originalUrl?: string;
};

@Injectable()
export class OidcService implements OnModuleInit {
  private privateKey!: CryptoKey;
  private publicJwk!: JWK;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async onModuleInit() {
    const keys = await loadOidcKeys();
    this.privateKey = keys.privateKey;
    this.publicJwk = keys.publicJwk;
  }

  publicOrigin() {
    return (this.config.get<string>('PUBLIC_ORIGIN') ?? 'http://127.0.0.1:5201').replace(/\/$/, '');
  }

  publicApiPrefix(req?: RequestLike): '/console/api' | '/middle/api' {
    const raw = req?.headers?.[PUBLIC_API_HEADER];
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (header === '/middle/api' || header === '/console/api') return header;
    const fromEnv = this.config.get<string>('OIDC_ISSUER') ?? DEFAULT_ISSUER;
    try {
      const path = new URL(fromEnv).pathname.replace(/\/oidc\/?$/, '');
      if (path === '/middle/api' || path === '/console/api') return path;
    } catch {
      /* fall through */
    }
    return '/console/api';
  }

  issuer(req?: RequestLike) {
    return `${this.publicOrigin()}${this.publicApiPrefix(req)}/oidc`;
  }

  authorizeUrl(req: RequestLike) {
    const original = req.originalUrl || '/api/oidc/authorize';
    const query = original.includes('?') ? original.slice(original.indexOf('?')) : '';
    return `${this.issuer(req)}/authorize${query}`;
  }

  clientId() {
    return this.config.get<string>('OIDC_CLIENT_ID') ?? CLIENT_ID;
  }

  discovery(req?: RequestLike) {
    const iss = this.issuer(req);
    return {
      issuer: iss,
      authorization_endpoint: `${iss}/authorize`,
      token_endpoint: `${iss}/token`,
      userinfo_endpoint: `${iss}/userinfo`,
      jwks_uri: `${iss}/jwks`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['openid', 'profile', 'email'],
    };
  }

  jwks() {
    return { keys: [this.publicJwk] };
  }

  /** 用本地公钥验签 id_token（access_token 与其同值）。验签失败会抛错，由调用方转 401。 */
  async verifyIdToken(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, createLocalJWKSet({ keys: [this.publicJwk] }));
    return payload;
  }

  isAllowedRedirect(uri: string) {
    try {
      const u = new URL(uri);
      return (
        u.pathname === '/api/auth/oidc/callback' ||
        u.pathname === '/agent/api/auth/oidc/callback'
      );
    } catch {
      return false;
    }
  }

  loginRedirect(authorizeUrl: string, hostname: string, protocol: string) {
    const pub =
      this.config.get<string>('PUBLIC_ORIGIN') ?? `${protocol}://${hostname}:5201`;
    return `${pub.replace(/\/$/, '')}/login?next=${encodeURIComponent(authorizeUrl)}`;
  }

  issueCode(user: User, params: {
    nonce: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    issuer: string;
    tenantId: string | null;
  }) {
    const code = randomBytes(24).toString('hex');
    saveCode(code, {
      sub: user.id,
      nonce: params.nonce,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      issuer: params.issuer,
      tenantId: params.tenantId,
      exp: Date.now() + 5 * 60 * 1000,
    });
    return code;
  }

  async exchange(
    input: {
      grant_type?: string;
      code?: string;
      redirect_uri?: string;
      client_id?: string;
      code_verifier?: string;
    },
    req?: RequestLike,
  ) {
    if (input.grant_type !== 'authorization_code') throw new UnauthorizedException('unsupported_grant');
    if (!input.code || !input.redirect_uri || !input.client_id || !input.code_verifier) {
      throw new UnauthorizedException('invalid_request');
    }
    if (input.client_id !== this.clientId()) throw new UnauthorizedException('invalid_client');
    const row = takeCode(input.code);
    if (!row || row.clientId !== input.client_id || row.redirectUri !== input.redirect_uri) {
      throw new UnauthorizedException('invalid_grant');
    }
    const challenge = createHash('sha256').update(input.code_verifier).digest('base64url');
    if (challenge !== row.codeChallenge) throw new UnauthorizedException('invalid_grant');

    const user = await this.prisma.user.findUnique({ where: { id: row.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('invalid_grant');

    const now = Math.floor(Date.now() / 1000);
    const idToken = await new SignJWT({
      nonce: row.nonce,
      name: user.name,
      preferred_username: user.phone,
      phone_number: user.phone,
      email: user.email ?? undefined,
      is_platform_admin: user.isPlatformAdmin,
    })
      .setProtectedHeader({ alg: 'RS256', kid: OIDC_KID })
      .setIssuer(row.issuer || this.issuer(req))
      .setAudience(this.clientId())
      .setSubject(user.id)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(this.privateKey);

    const consoleHandoffToken = this.jwt.sign(
      { sub: user.id, tenantId: row.tenantId ?? null },
      { expiresIn: '7d' },
    );

    return {
      access_token: idToken,
      token_type: 'Bearer',
      expires_in: 300,
      id_token: idToken,
      console_handoff_token: consoleHandoffToken,
    };
  }

  async userinfo(sub: string) {
    const user = await this.prisma.user.findUnique({ where: { id: sub } });
    // 被停用者 5 分钟 token 窗口内不应还能取 userinfo（与 userFromCookie/JwtGuard 的检查对齐）。
    if (!user || user.status !== 'active') throw new UnauthorizedException('invalid_token');
    return {
      sub: user.id,
      name: user.name,
      preferred_username: user.phone,
      phone_number: user.phone,
      email: user.email ?? undefined,
      is_platform_admin: user.isPlatformAdmin,
    };
  }
}
