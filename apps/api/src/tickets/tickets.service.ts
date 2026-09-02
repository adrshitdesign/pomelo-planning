import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.module';
import { StatusesService } from '../statuses/statuses.module';
import type {
  CreateTicketDto,
  DuplicateTicketDto,
  MoveTicketDto,
  TicketQueryDto,
  UpdateTicketDto,
} from './dto/ticket.dto';

const TICKET_INCLUDE = {
  status: true,
  team: { select: { id: true, name: true, color: true } },
  creator: { select: { id: true, name: true, avatarUrl: true } },
  projectObject: {
    select: {
      id: true,
      name: true,
      color: true,
      client: { select: { id: true, name: true, color: true } },
    },
  },
  assignees: {
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly statuses: StatusesService,
  ) {}

  async list(query: TicketQueryDto) {
    const where = this.buildWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
        take: Math.min(query.take ?? 200, 500),
        skip: query.skip ?? 0,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total };
  }

  private buildWhere(query: TicketQueryDto): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};
    if (!query.includeArchived) where.archivedAt = null;
    if (query.statusId) where.statusId = query.statusId;
    if (query.teamId) where.teamId = query.teamId;
    if (query.priority) where.priority = query.priority;
    if (query.projectObjectId) where.projectObjectId = query.projectObjectId;
    if (query.clientId) where.projectObject = { clientId: query.clientId };
    if (query.assigneeId) where.assignees = { some: { userId: query.assigneeId } };
    if (query.unscheduled) where.startAt = null;

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Chevauchement de plage pour les vues planning.
    if (query.from || query.to) {
      where.AND = [
        ...(query.to ? [{ startAt: { lte: new Date(query.to) } }] : []),
        ...(query.from ? [{ endAt: { gte: new Date(query.from) } }] : []),
      ];
    }
    return where;
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...TICKET_INCLUDE,
        comments: {
          where: { archivedAt: null },
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');
    return ticket;
  }

  async create(dto: CreateTicketDto, actorId: string) {
    this.assertRange(dto.startAt, dto.endAt);
    const statusId = dto.statusId ?? (await this.statuses.getDefault()).id;

    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        statusId,
        priority: dto.priority,
        color: dto.color,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        estimatedMinutes: dto.estimatedMinutes,
        actualMinutes: dto.actualMinutes,
        creatorId: actorId,
        teamId: dto.teamId,
        projectObjectId: dto.projectObjectId,
        assignees: {
          create: (dto.assignees ?? []).map((a) => ({
            userId: a.userId,
            startAt: a.startAt ? new Date(a.startAt) : null,
            endAt: a.endAt ? new Date(a.endAt) : null,
          })),
        },
      },
      include: TICKET_INCLUDE,
    });

    await this.audit.log({
      actorId,
      action: 'ticket.created',
      entityType: 'TICKET',
      entityId: ticket.id,
      metadata: { title: ticket.title },
    });
    this.realtime.broadcast('ticket.created', ticket);
    await this.notifications.notify({
      recipientIds: ticket.assignees.map((a) => a.userId),
      type: 'ticket.assigned',
      title: `Nouveau ticket : ${ticket.title}`,
      entityType: 'TICKET',
      entityId: ticket.id,
      excludeUserId: actorId,
    });
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, actorId: string) {
    const before = await this.prisma.ticket.findUnique({
      where: { id },
      include: { assignees: true },
    });
    if (!before) throw new NotFoundException('Ticket introuvable');

    const startAt = dto.startAt ?? before.startAt?.toISOString();
    const endAt = dto.endAt ?? before.endAt?.toISOString();
    this.assertRange(startAt, endAt);

    if (dto.assignees) {
      await this.prisma.ticketAssignee.deleteMany({ where: { ticketId: id } });
      await this.prisma.ticketAssignee.createMany({
        data: dto.assignees.map((a) => ({
          ticketId: id,
          userId: a.userId,
          startAt: a.startAt ? new Date(a.startAt) : null,
          endAt: a.endAt ? new Date(a.endAt) : null,
        })),
        skipDuplicates: true,
      });
    }

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        statusId: dto.statusId,
        priority: dto.priority,
        color: dto.color,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        estimatedMinutes: dto.estimatedMinutes,
        actualMinutes: dto.actualMinutes,
        teamId: dto.teamId,
        projectObjectId: dto.projectObjectId,
      },
      include: TICKET_INCLUDE,
    });

    const action = dto.statusId && dto.statusId !== before.statusId ? 'ticket.status_changed' : 'ticket.updated';
    await this.audit.log({
      actorId,
      action,
      entityType: 'TICKET',
      entityId: id,
      metadata: { before: { statusId: before.statusId }, after: { statusId: ticket.statusId } },
    });
    this.realtime.broadcast('ticket.updated', ticket);

    // Notifier les nouveaux assignés uniquement.
    if (dto.assignees) {
      const previous = new Set(before.assignees.map((a) => a.userId));
      await this.notifications.notify({
        recipientIds: ticket.assignees.map((a) => a.userId).filter((uid) => !previous.has(uid)),
        type: 'ticket.assigned',
        title: `Ticket assigné : ${ticket.title}`,
        entityType: 'TICKET',
        entityId: ticket.id,
        excludeUserId: actorId,
      });
    }
    return ticket;
  }

  /** Glisser-déposer / redimensionnement dans le planning. */
  async move(id: string, dto: MoveTicketDto, actorId: string) {
    const before = await this.prisma.ticket.findUnique({ where: { id } });
    if (!before || before.archivedAt) throw new NotFoundException('Ticket introuvable');
    this.assertRange(dto.startAt, dto.endAt);

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({ where: { id }, data: { startAt, endAt } });

      // Glissé sur la ligne d'une autre personne → l'assignation suit.
      if (dto.assigneeId) {
        if (dto.previousAssigneeId && dto.previousAssigneeId !== dto.assigneeId) {
          await tx.ticketAssignee.deleteMany({
            where: { ticketId: id, userId: dto.previousAssigneeId },
          });
        }
        await tx.ticketAssignee.upsert({
          where: { ticketId_userId: { ticketId: id, userId: dto.assigneeId } },
          update: { startAt, endAt },
          create: { ticketId: id, userId: dto.assigneeId, startAt, endAt },
        });
      } else {
        // Les créneaux par assigné suivent le déplacement global.
        await tx.ticketAssignee.updateMany({
          where: { ticketId: id, startAt: { not: null } },
          data: { startAt, endAt },
        });
      }
    });

    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id },
      include: TICKET_INCLUDE,
    });

    await this.audit.log({
      actorId,
      action: 'ticket.moved',
      entityType: 'TICKET',
      entityId: id,
      metadata: {
        from: { startAt: before.startAt, endAt: before.endAt },
        to: { startAt, endAt },
        assigneeId: dto.assigneeId,
      },
    });
    this.realtime.broadcast('ticket.moved', ticket);

    if (dto.assigneeId) {
      await this.notifications.notify({
        recipientIds: [dto.assigneeId],
        type: 'ticket.assigned',
        title: `Ticket planifié : ${ticket.title}`,
        entityType: 'TICKET',
        entityId: id,
        excludeUserId: actorId,
      });
    }
    return ticket;
  }

  /** Ctrl/Cmd + glisser → duplication. */
  async duplicate(id: string, dto: DuplicateTicketDto, actorId: string) {
    const source = await this.prisma.ticket.findUnique({
      where: { id },
      include: { assignees: true },
    });
    if (!source) throw new NotFoundException('Ticket introuvable');

    const durationMs =
      source.startAt && source.endAt ? source.endAt.getTime() - source.startAt.getTime() : 3600_000;
    const startAt = dto.startAt ? new Date(dto.startAt) : source.startAt;
    const endAt = startAt ? new Date(startAt.getTime() + durationMs) : null;

    const ticket = await this.prisma.ticket.create({
      data: {
        title: `${source.title} (copie)`,
        description: source.description,
        statusId: source.statusId,
        priority: source.priority,
        color: source.color,
        startAt,
        endAt,
        estimatedMinutes: source.estimatedMinutes,
        creatorId: actorId,
        teamId: source.teamId,
        projectObjectId: source.projectObjectId,
        assignees:
          dto.keepAssignees === false
            ? undefined
            : {
                create: source.assignees.map((a) => ({
                  userId: a.userId,
                  startAt: a.startAt ? startAt : null,
                  endAt: a.endAt ? endAt : null,
                })),
              },
      },
      include: TICKET_INCLUDE,
    });

    await this.audit.log({
      actorId,
      action: 'ticket.duplicated',
      entityType: 'TICKET',
      entityId: ticket.id,
      metadata: { sourceId: id },
    });
    this.realtime.broadcast('ticket.created', ticket);
    return ticket;
  }

  async archive(id: string, actorId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket introuvable');

    await this.prisma.ticket.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log({ actorId, action: 'ticket.archived', entityType: 'TICKET', entityId: id });
    this.realtime.broadcast('ticket.archived', { id });
    return { success: true };
  }

  async restore(id: string, actorId: string) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { archivedAt: null },
      include: TICKET_INCLUDE,
    });
    await this.audit.log({ actorId, action: 'ticket.restored', entityType: 'TICKET', entityId: id });
    this.realtime.broadcast('ticket.updated', ticket);
    return ticket;
  }

  private assertRange(startAt?: string | null, endAt?: string | null) {
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début');
    }
  }
}
