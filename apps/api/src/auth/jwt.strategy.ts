import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser, JwtAccessPayload } from '../common/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Recharge l'utilisateur à chaque requête : une session révoquée ou un compte
   * désactivé invalide immédiatement le token, sans attendre son expiration.
   */
  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') throw new UnauthorizedException();

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: { revokedAt: true, expiresAt: true, userId: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session révoquée ou expirée');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        memberships: { select: { teamId: true } },
      },
    });

    if (!user || !user.isActive || user.archivedAt) {
      throw new UnauthorizedException('Compte inactif');
    }

    const permissions = new Set<string>();
    for (const ur of user.roles) {
      if (ur.role.archivedAt) continue;
      for (const rp of ur.role.permissions) permissions.add(rp.permission.key);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      sessionId: payload.sid,
      roles: user.roles.map((r) => r.role.key),
      permissions: [...permissions],
      teamIds: user.memberships.map((m) => m.teamId),
    };
  }
}
