import { Injectable, Logger } from '@nestjs/common';
import { EntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: keyof typeof EntityType;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Journalisation best-effort : une erreur d'audit ne casse jamais l'action métier. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: EntityType[entry.entityType],
          entityId: entry.entityId,
          metadata: entry.metadata,
        },
      });
    } catch (error) {
      this.logger.warn(`Audit non enregistré (${entry.action}) : ${String(error)}`);
    }
  }

  async list(params: { entityType?: keyof typeof EntityType; entityId?: string; take?: number; skip?: number }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (params.entityType) where.entityType = EntityType[params.entityType];
    if (params.entityId) where.entityId = params.entityId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: Math.min(params.take ?? 50, 200),
        skip: params.skip ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
