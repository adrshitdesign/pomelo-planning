import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { JwtRefreshPayload } from '../common/types';

const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON_OPTIONS);
  }

  async login(email: string, password: string, ctx: SessionContext = {}) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Message volontairement identique dans tous les cas d'échec.
    const invalid = new UnauthorizedException('Identifiants invalides');
    if (!user || !user.isActive || user.archivedAt) {
      // Comparaison factice pour égaliser le temps de réponse.
      await argon2.hash(password, ARGON_OPTIONS).catch(() => undefined);
      throw invalid;
    }
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) throw invalid;

    const tokens = await this.createSession(user.id, user.email, ctx);
    await this.audit.log({ actorId: user.id, action: 'auth.login', entityType: 'USER', entityId: user.id });
    return tokens;
  }

  /** Crée une session révocable et renvoie la paire de tokens. */
  private async createSession(userId: string, email: string, ctx: SessionContext) {
    const sessionId = randomUUID();
    const refreshTtlDays = this.parseTtlDays(this.config.get<string>('JWT_REFRESH_TTL', '30d'));
    const expiresAt = new Date(Date.now() + refreshTtlDays * 86_400_000);

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'refresh' } satisfies JwtRefreshPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '30d'),
      },
    );

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: await argon2.hash(refreshToken, ARGON_OPTIONS),
        userAgent: ctx.userAgent?.slice(0, 255),
        ipAddress: ctx.ipAddress,
        expiresAt,
      },
    });

    const accessToken = await this.signAccessToken(userId, sessionId, email);
    return { accessToken, refreshToken, expiresAt };
  }

  private signAccessToken(userId: string, sessionId: string, email: string) {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, email, type: 'access' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
      },
    );
  }

  /** Rotation du refresh token : l'ancien est invalidé à chaque usage. */
  async refresh(refreshToken: string, ctx: SessionContext = {}) {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException();

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expirée');
    }
    const matches = await argon2.verify(session.refreshTokenHash, refreshToken).catch(() => false);
    if (!matches) {
      // Réutilisation d'un token déjà tourné → on coupe toutes les sessions.
      await this.revokeAllSessions(session.userId);
      throw new UnauthorizedException('Refresh token réutilisé, sessions révoquées');
    }
    if (!session.user.isActive || session.user.archivedAt) {
      throw new UnauthorizedException('Compte inactif');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.createSession(session.userId, session.user.email, ctx);
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Session introuvable');
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
    if (!ok) throw new BadRequestException('Mot de passe actuel incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await AuthService.hashPassword(newPassword) },
    });
    // Toutes les autres sessions tombent.
    await this.revokeAllSessions(userId);
    await this.audit.log({
      actorId: userId,
      action: 'auth.password_changed',
      entityType: 'USER',
      entityId: userId,
    });
    return { success: true };
  }

  private parseTtlDays(ttl: string): number {
    const match = /^(\d+)([dhm])$/.exec(ttl.trim());
    if (!match) return 30;
    const value = Number(match[1]);
    switch (match[2]) {
      case 'd':
        return value;
      case 'h':
        return value / 24;
      default:
        return value / 1440;
    }
  }
}
