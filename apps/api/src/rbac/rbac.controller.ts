import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from './permissions';
import type { AuthenticatedUser } from '../common/types';

@ApiTags('rbac')
@Controller()
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Get('roles')
  listRoles() {
    return this.rbac.listRoles();
  }

  @Post('roles')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rbac.createRole(dto, user.id);
  }

  @Patch('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rbac.updateRole(id, dto, user.id);
  }

  @Delete('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  archiveRole(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rbac.archiveRole(id, user.id);
  }
}
