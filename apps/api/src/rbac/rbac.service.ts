import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      where: { archivedAt: null },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.key),
    }));
  }

  async createRole(dto: CreateRoleDto, actorId: string) {
    const exists = await this.prisma.role.findUnique({ where: { key: dto.key } });
    if (exists) throw new BadRequestException('Cette clé de rôle existe déjà');

    const permissions = await this.resolvePermissions(dto.permissions);
    const role = await this.prisma.role.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
    });
    await this.audit.log({ actorId, action: 'role.created', entityType: 'ROLE', entityId: role.id });
    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto, actorId: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role || role.archivedAt) throw new NotFoundException('Rôle introuvable');

    if (dto.permissions) {
      const permissions = await this.resolvePermissions(dto.permissions);
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
    });
    await this.audit.log({
      actorId,
      action: 'role.updated',
      entityType: 'ROLE',
      entityId: id,
      metadata: { permissions: dto.permissions },
    });
    return updated;
  }

  async archiveRole(id: string, actorId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Rôle introuvable');
    if (role.isSystem) throw new BadRequestException('Un rôle système ne peut pas être supprimé');
    if (role._count.users > 0) {
      throw new BadRequestException('Des utilisateurs portent encore ce rôle');
    }

    await this.prisma.role.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log({ actorId, action: 'role.archived', entityType: 'ROLE', entityId: id });
    return { success: true };
  }

  private async resolvePermissions(keys: string[]) {
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: keys } } });
    if (permissions.length !== keys.length) {
      const found = new Set(permissions.map((p) => p.key));
      throw new BadRequestException(
        `Permissions inconnues : ${keys.filter((k) => !found.has(k)).join(', ')}`,
      );
    }
    return permissions;
  }
}
