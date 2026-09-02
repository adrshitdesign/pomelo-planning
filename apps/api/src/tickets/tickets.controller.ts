import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  DuplicateTicketDto,
  MoveTicketDto,
  TicketQueryDto,
  UpdateTicketDto,
} from './dto/ticket.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../rbac/permissions';
import type { AuthenticatedUser } from '../common/types';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TICKET_VIEW)
  list(@Query() query: TicketQueryDto) {
    return this.tickets.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TICKET_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TICKET_CREATE)
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TICKET_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.update(id, dto, user.id);
  }

  /** Drag & drop et redimensionnement — permission dédiée planning:move. */
  @Patch(':id/move')
  @RequirePermissions(PERMISSIONS.PLANNING_MOVE)
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.move(id, dto, user.id);
  }

  @Post(':id/duplicate')
  @RequirePermissions(PERMISSIONS.TICKET_CREATE)
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.duplicate(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TICKET_ARCHIVE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.archive(id, user.id);
  }

  @Post(':id/restore')
  @RequirePermissions(PERMISSIONS.TICKET_ARCHIVE)
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.restore(id, user.id);
  }
}
