import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { TicketsModule } from '../tickets/tickets.module';
import { EventsModule } from '../events/events.module';
import { TicketsService } from '../tickets/tickets.service';
import { EventsService } from '../events/events.module';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';

export class PlanningQueryDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() projectObjectId?: string;
}

/**
 * Un seul appel pour peindre le planning : ressources (personnes) + tickets +
 * événements sur la plage demandée.
 */
@Injectable()
export class PlanningService {
  constructor(
    private readonly tickets: TicketsService,
    private readonly events: EventsService,
    private readonly prisma: PrismaService,
  ) {}

  async getPlanning(query: PlanningQueryDto) {
    const [ticketResult, events, resources] = await Promise.all([
      this.tickets.list({
        from: query.from,
        to: query.to,
        teamId: query.teamId,
        clientId: query.clientId,
        projectObjectId: query.projectObjectId,
        assigneeId: query.userId,
        take: 500,
      }),
      this.events.list({
        from: query.from,
        to: query.to,
        teamId: query.teamId,
        participantId: query.userId,
        projectObjectId: query.projectObjectId,
      }),
      this.prisma.user.findMany({
        where: {
          archivedAt: null,
          isActive: true,
          ...(query.teamId ? { memberships: { some: { teamId: query.teamId } } } : {}),
          ...(query.userId ? { id: query.userId } : {}),
        },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          memberships: { select: { team: { select: { id: true, name: true, color: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      range: { from: query.from, to: query.to },
      resources: resources.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        teams: u.memberships.map((m) => m.team),
      })),
      tickets: ticketResult.items,
      events,
    };
  }
}

@ApiTags('planning')
@Controller('planning')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PLANNING_VIEW)
  get(@Query() query: PlanningQueryDto) {
    return this.planning.getPlanning(query);
  }
}

@Module({
  imports: [TicketsModule, EventsModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
