import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.module';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import type { AuthenticatedUser } from '../common/types';

export class CreateCommentDto {
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  list(ticketId: string) {
    return this.prisma.comment.findMany({
      where: { ticketId, archivedAt: null },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(ticketId: string, body: string, actorId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');

    const comment = await this.prisma.comment.create({
      data: { ticketId, authorId: actorId, body },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    await this.audit.log({
      actorId,
      action: 'comment.created',
      entityType: 'COMMENT',
      entityId: comment.id,
      metadata: { ticketId },
    });
    this.realtime.broadcast('comment.created', comment);
    await this.notifications.notify({
      recipientIds: [...ticket.assignees.map((a) => a.userId), ticket.creatorId],
      type: 'comment.created',
      title: `Nouveau commentaire sur « ${ticket.title} »`,
      body: body.slice(0, 140),
      entityType: 'TICKET',
      entityId: ticketId,
      excludeUserId: actorId,
    });
    return comment;
  }

  async archive(id: string, user: AuthenticatedUser) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.archivedAt) throw new NotFoundException('Commentaire introuvable');

    // Son propre commentaire, ou la permission d'archivage.
    if (comment.authorId !== user.id && !user.permissions.includes(PERMISSIONS.COMMENT_ARCHIVE)) {
      throw new NotFoundException('Commentaire introuvable');
    }

    await this.prisma.comment.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log({
      actorId: user.id,
      action: 'comment.archived',
      entityType: 'COMMENT',
      entityId: id,
    });
    return { success: true };
  }
}

@ApiTags('comments')
@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMENT_VIEW)
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.comments.list(ticketId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMMENT_CREATE)
  create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.comments.create(ticketId, dto.body, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.COMMENT_VIEW)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.comments.archive(id, user);
  }
}
