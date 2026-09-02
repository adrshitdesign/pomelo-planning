import {
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
import {
  IsEmail,
  IsHexColor,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import type { AuthenticatedUser } from '../common/types';

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export class CreateClientDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateClientDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreateProjectObjectDto {
  @IsUUID() clientId!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsHexColor() color?: string;
}

export class UpdateProjectObjectDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsHexColor() color?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.client.findMany({
      where: { archivedAt: null },
      include: {
        projectObjects: {
          where: { archivedAt: null },
          include: { _count: { select: { tickets: true, events: true } } },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        projectObjects: {
          where: { archivedAt: null },
          include: { _count: { select: { tickets: true, events: true } } },
        },
      },
    });
    if (!client || client.archivedAt) throw new NotFoundException('Client introuvable');
    return client;
  }

  async create(dto: CreateClientDto, actorId: string) {
    const client = await this.prisma.client.create({ data: dto });
    await this.audit.log({
      actorId,
      action: 'client.created',
      entityType: 'CLIENT',
      entityId: client.id,
    });
    return client;
  }

  async update(id: string, dto: UpdateClientDto, actorId: string) {
    await this.findOne(id);
    const client = await this.prisma.client.update({ where: { id }, data: dto });
    await this.audit.log({ actorId, action: 'client.updated', entityType: 'CLIENT', entityId: id });
    return client;
  }

  async archive(id: string, actorId: string) {
    await this.findOne(id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.client.update({ where: { id }, data: { archivedAt: now } }),
      this.prisma.projectObject.updateMany({
        where: { clientId: id, archivedAt: null },
        data: { archivedAt: now },
      }),
    ]);
    await this.audit.log({ actorId, action: 'client.archived', entityType: 'CLIENT', entityId: id });
    return { success: true };
  }

  // --- Objets -------------------------------------------------------------

  listObjects(clientId?: string) {
    return this.prisma.projectObject.findMany({
      where: { archivedAt: null, ...(clientId ? { clientId } : {}) },
      include: { client: { select: { id: true, name: true, color: true } } },
      orderBy: [{ clientId: 'asc' }, { name: 'asc' }],
    });
  }

  async createObject(dto: CreateProjectObjectDto, actorId: string) {
    await this.findOne(dto.clientId);
    const object = await this.prisma.projectObject.create({ data: dto });
    await this.audit.log({
      actorId,
      action: 'project_object.created',
      entityType: 'PROJECT_OBJECT',
      entityId: object.id,
    });
    return object;
  }

  async updateObject(id: string, dto: UpdateProjectObjectDto, actorId: string) {
    const existing = await this.prisma.projectObject.findUnique({ where: { id } });
    if (!existing || existing.archivedAt) throw new NotFoundException('Objet introuvable');

    const object = await this.prisma.projectObject.update({ where: { id }, data: dto });
    await this.audit.log({
      actorId,
      action: 'project_object.updated',
      entityType: 'PROJECT_OBJECT',
      entityId: id,
    });
    return object;
  }

  async archiveObject(id: string, actorId: string) {
    await this.prisma.projectObject.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log({
      actorId,
      action: 'project_object.archived',
      entityType: 'PROJECT_OBJECT',
      entityId: id,
    });
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLIENT_VIEW)
  list() {
    return this.clients.list();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLIENT_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLIENT_MANAGE)
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLIENT_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clients.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLIENT_MANAGE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.archive(id, user.id);
  }
}

@ApiTags('project-objects')
@Controller('project-objects')
export class ProjectObjectsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROJECT_OBJECT_VIEW)
  list(@Query('clientId') clientId?: string) {
    return this.clients.listObjects(clientId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECT_OBJECT_MANAGE)
  create(@Body() dto: CreateProjectObjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.createObject(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PROJECT_OBJECT_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectObjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clients.updateObject(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PROJECT_OBJECT_MANAGE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clients.archiveObject(id, user.id);
  }
}

@Module({
  controllers: [ClientsController, ProjectObjectsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
