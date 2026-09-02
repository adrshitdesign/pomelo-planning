import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EntityType } from '@prisma/client';
import { IsEnum, IsOptional, IsInt, Min, IsUUID } from 'class-validator';
import { AuditService } from './audit.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';

class AuditQueryDto {
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: keyof typeof EntityType;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  take?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;
}

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
