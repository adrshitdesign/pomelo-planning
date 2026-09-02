import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import type { CreateUserDto, UpdateUserDto } from './dto/user.dto';

/** Ne jamais exposer passwordHash côté frontend (brief section 11). */
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  isActive: true,
  archivedAt: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
  memberships: { select: { team: { select: { id: true, name: true, color: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(includeArchived = false) {
    const users = await this.prisma.user.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
    return users.map(this.flatten);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.flatten(user);
  }

  async create(dto: CreateUserDto, actorId: string) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new BadRequestException('Un compte existe déjà avec cet email');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        avatarUrl: dto.avatarUrl,
        passwordHash: await AuthService.hashPassword(dto.password),
        roles: { create: (dto.roleIds ?? []).map((roleId) => ({ roleId })) },
        memberships: { create: (dto.teamIds ?? []).map((teamId) => ({ teamId })) },
      },
      select: USER_SELECT,
    });
    await this.audit.log({ actorId, action: 'user.created', entityType: 'USER', entityId: user.id });
    return this.flatten(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    await this.assertExists(id);

    if (dto.roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
        skipDuplicates: true,
      });
    }
    if (dto.teamIds) {
      await this.prisma.teamMembership.deleteMany({ where: { userId: id } });
      await this.prisma.teamMembership.createMany({
        data: dto.teamIds.map((teamId) => ({ userId: id, teamId })),
        skipDuplicates: true,
      });
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, avatarUrl: dto.avatarUrl, isActive: dto.isActive },
      select: USER_SELECT,
    });

    // Un compte désactivé perd ses sessions immédiatement.
    if (dto.isActive === false) {
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      actorId,
      action: 'user.updated',
      entityType: 'USER',
      entityId: id,
      metadata: { ...dto },
    });
    return this.flatten(user);
  }

  async resetPassword(id: string, password: string, actorId: string) {
    await this.assertExists(id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await AuthService.hashPassword(password) },
    });
    await this.prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId,
      action: 'user.password_reset',
      entityType: 'USER',
      entityId: id,
    });
    return { success: true };
  }

  /** Archivage, jamais de suppression définitive (brief section 4). */
  async archive(id: string, actorId: string) {
    await this.assertExists(id);
    if (id === actorId) throw new BadRequestException('Impossible d’archiver son propre compte');

    await this.prisma.user.update({
      where: { id },
      data: { archivedAt: new Date(), isActive: false },
    });
    await this.prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ actorId, action: 'user.archived', entityType: 'USER', entityId: id });
    return { success: true };
  }

  async restore(id: string, actorId: string) {
    await this.prisma.user.update({
      where: { id },
      data: { archivedAt: null, isActive: true },
    });
    await this.audit.log({ actorId, action: 'user.restored', entityType: 'USER', entityId: id });
    return { success: true };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Utilisateur introuvable');
  }

  private flatten = (user: {
    roles: { role: { id: string; key: string; name: string } }[];
    memberships: { team: { id: string; name: string; color: string } }[];
    [key: string]: unknown;
  }) => ({
    ...user,
    roles: user.roles.map((r) => r.role),
    teams: user.memberships.map((m) => m.team),
    memberships: undefined,
  });
}
