import { Body, Controller, Delete, Get, Injectable, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import type { AuthenticatedUser } from '../common/types';

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.team.findMany({
      where: { archivedAt: null },
      include: {
        memberships: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { tickets: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        memberships: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    });
    if (!team || team.archivedAt) throw new NotFoundException('Équipe introuvable');
    return team;
  }

  async create(dto: CreateTeamDto, actorId: string) {
    const team = await this.prisma.team.create({ data: dto });
    await this.audit.log({ actorId, action: 'team.created', entityType: 'TEAM', entityId: team.id });
    return team;
  }

  async update(id: string, dto: UpdateTeamDto, actorId: string) {
    await this.findOne(id);
    const team = await this.prisma.team.update({ where: { id }, data: dto });
    await this.audit.log({ actorId, action: 'team.updated', entityType: 'TEAM', entityId: id });
    return team;
  }

  async archive(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.team.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log({ actorId, action: 'team.archived', entityType: 'TEAM', entityId: id });
    return { success: true };
  }

  async addMember(teamId: string, userId: string, isLead = false) {
    return this.prisma.teamMembership.upsert({
      where: { userId_teamId: { userId, teamId } },
      update: { isLead },
      create: { userId, teamId, isLead },
    });
  }

  async removeMember(teamId: string, userId: string) {
    await this.prisma.teamMembership.deleteMany({ where: { teamId, userId } });
    return { success: true };
  }
}

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TEAM_VIEW)
  list() {
    return this.teams.list();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TEAM_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teams.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teams.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teams.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.teams.archive(id, user.id);
  }

  @Post(':id/members/:userId')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teams.addMember(id, userId);
  }

  @Delete(':id/members/:userId')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teams.removeMember(id, userId);
  }
}

@Module({
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
