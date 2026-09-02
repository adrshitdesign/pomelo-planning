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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import type { AuthenticatedUser } from '../common/types';

export class CreateStatusDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,30}$/, { message: 'Clé en minuscules sans espace (ex: en_relecture)' })
  key!: string;

  @IsString() @MinLength(2) @MaxLength(40) name!: string;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isFinal?: boolean;
}

export class UpdateStatusDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) name?: string;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isFinal?: boolean;
}

@Injectable()
export class StatusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.status.findMany({
      where: { archivedAt: null },
      orderBy: { position: 'asc' },
    });
  }

  /** Statut appliqué par défaut à la création d'un ticket. */
  async getDefault() {
    const status =
      (await this.prisma.status.findFirst({ where: { isDefault: true, archivedAt: null } })) ??
      (await this.prisma.status.findFirst({ where: { archivedAt: null }, orderBy: { position: 'asc' } }));
    if (!status) throw new BadRequestException('Aucun statut configuré');
    return status;
  }

  async create(dto: CreateStatusDto, actorId: string) {
    if (await this.prisma.status.findUnique({ where: { key: dto.key } })) {
      throw new BadRequestException('Cette clé de statut existe déjà');
    }
    if (dto.isDefault) await this.clearDefault();

    const status = await this.prisma.status.create({ data: dto });
    await this.audit.log({
      actorId,
      action: 'status.created',
      entityType: 'STATUS',
      entityId: status.id,
    });
    return status;
  }

  async update(id: string, dto: UpdateStatusDto, actorId: string) {
    const existing = await this.prisma.status.findUnique({ where: { id } });
    if (!existing || existing.archivedAt) throw new NotFoundException('Statut introuvable');
    if (dto.isDefault) await this.clearDefault();

    const status = await this.prisma.status.update({ where: { id }, data: dto });
    await this.audit.log({ actorId, action: 'status.updated', entityType: 'STATUS', entityId: id });
    return status;
  }

  async reorder(ids: string[], actorId: string) {
    await this.prisma.$transaction(
      ids.map((id, position) => this.prisma.status.update({ where: { id }, data: { position } })),
    );
    await this.audit.log({
      actorId,
      action: 'status.reordered',
      entityType: 'STATUS',
      entityId: ids[0] ?? '-',
      metadata: { ids },
    });
    return this.list();
  }

  async archive(id: string, actorId: string) {
    const inUse = await this.prisma.ticket.count({ where: { statusId: id, archivedAt: null } });
    if (inUse > 0) {
      throw new BadRequestException(`${inUse} ticket(s) utilisent encore ce statut`);
    }
    await this.prisma.status.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log({ actorId, action: 'status.archived', entityType: 'STATUS', entityId: id });
    return { success: true };
  }

  private clearDefault() {
    return this.prisma.status.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
}

@ApiTags('statuses')
@Controller('statuses')
export class StatusesController {
  constructor(private readonly statuses: StatusesService) {}

  @Get()
  list() {
    return this.statuses.list();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STATUS_MANAGE)
  create(@Body() dto: CreateStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.statuses.create(dto, user.id);
  }

  @Patch('reorder')
  @RequirePermissions(PERMISSIONS.STATUS_MANAGE)
  reorder(@Body() body: { ids: string[] }, @CurrentUser() user: AuthenticatedUser) {
    return this.statuses.reorder(body.ids, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.STATUS_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.statuses.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.STATUS_MANAGE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.statuses.archive(id, user.id);
  }
}

@Module({
  controllers: [StatusesController],
  providers: [StatusesService],
  exports: [StatusesService],
})
export class StatusesModule {}
