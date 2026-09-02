import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventType, Prisma } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import type { AuthenticatedUser } from '../common/types';

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export class CreateEventDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsEnum(EventType) type?: EventType;
  @IsOptional() @IsHexColor() color?: string;
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
  @IsOptional() @IsBoolean() isAllDay?: boolean;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() projectObjectId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) participantIds?: string[];
}

export class UpdateEventDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsEnum(EventType) type?: EventType;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsBoolean() isAllDay?: boolean;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() projectObjectId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) participantIds?: string[];
}

export class EventQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() participantId?: string;
  @IsOptional() @IsUUID() projectObjectId?: string;
  @IsOptional() @IsEnum(EventType) type?: EventType;
  @IsOptional() @IsBoolean() includeArchived?: boolean;
}

const EVENT_INCLUDE = {
  team: { select: { id: true, name: true, color: true } },
  creator: { select: { id: true, name: true, avatarUrl: true } },
  projectObject: {
    select: { id: true, name: true, client: { select: { id: true, name: true } } },
  },
  participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
} satisfies Prisma.EventInclude;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  list(query: EventQueryDto) {
    const where: Prisma.EventWhereInput = {};
    if (!query.includeArchived) where.archivedAt = null;
    if (query.teamId) where.teamId = query.teamId;
    if (query.type) where.type = query.type;
    if (query.projectObjectId) where.projectObjectId = query.projectObjectId;
    if (query.participantId) where.participants = { some: { userId: query.participantId } };
    if (query.from || query.to) {
      where.AND = [
        ...(query.to ? [{ startAt: { lte: new Date(query.to) } }] : []),
        ...(query.from ? [{ endAt: { gte: new Date(query.from) } }] : []),
      ];
    }
    return this.prisma.event.findMany({
      where,
      include: EVENT_INCLUDE,
      orderBy: { startAt: 'asc' },
      take: 500,
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: EVENT_INCLUDE });
    if (!event) throw new NotFoundException('Événement introuvable');
    return event;
  }

  async create(dto: CreateEventDto, actorId: string) {
    this.assertRange(dto.startAt, dto.endAt);
    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        color: dto.color,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        isAllDay: dto.isAllDay,
        location: dto.location,
        creatorId: actorId,
        teamId: dto.teamId,
        projectObjectId: dto.projectObjectId,
        participants: {
          create: [
            { userId: actorId, isOwner: true },
            ...(dto.participantIds ?? [])
              .filter((id) => id !== actorId)
              .map((userId) => ({ userId })),
          ],
        },
      },
      include: EVENT_INCLUDE,
    });

    await this.audit.log({
      actorId,
      action: 'event.created',
      entityType: 'EVENT',
      entityId: event.id,
    });
    this.realtime.broadcast('event.created', event);
    await this.notifications.notify({
      recipientIds: event.participants.map((p) => p.userId),
      type: 'event.invited',
      title: `Invitation : ${event.title}`,
      entityType: 'EVENT',
      entityId: event.id,
      excludeUserId: actorId,
    });
    return event;
  }

  async update(id: string, dto: UpdateEventDto, actorId: string) {
    const before = await this.findOne(id);
    this.assertRange(dto.startAt ?? before.startAt.toISOString(), dto.endAt ?? before.endAt.toISOString());

    if (dto.participantIds) {
      await this.prisma.eventParticipant.deleteMany({ where: { eventId: id, isOwner: false } });
      await this.prisma.eventParticipant.createMany({
        data: dto.participantIds.map((userId) => ({ eventId: id, userId })),
        skipDuplicates: true,
      });
    }

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        color: dto.color,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        isAllDay: dto.isAllDay,
        location: dto.location,
        teamId: dto.teamId,
        projectObjectId: dto.projectObjectId,
      },
      include: EVENT_INCLUDE,
    });

    await this.audit.log({ actorId, action: 'event.updated', entityType: 'EVENT', entityId: id });
    this.realtime.broadcast('event.updated', event);
    return event;
  }

  async archive(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.event.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log({ actorId, action: 'event.archived', entityType: 'EVENT', entityId: id });
    this.realtime.broadcast('event.archived', { id });
    return { success: true };
  }

  private assertRange(startAt: string, endAt: string) {
    if (new Date(endAt) <= new Date(startAt)) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début');
    }
  }
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EVENT_VIEW)
  list(@Query() query: EventQueryDto) {
    return this.events.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EVENT_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EVENT_CREATE)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.events.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EVENT_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.events.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EVENT_ARCHIVE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.events.archive(id, user.id);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
