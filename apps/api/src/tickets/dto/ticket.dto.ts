import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class AssigneeInputDto {
  @IsUUID() userId!: string;

  /** Créneau propre à l'assigné (optionnel) — brief section 4. */
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
}

export class CreateTicketDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsUUID() statusId?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsInt() @Min(0) estimatedMinutes?: number;
  @IsOptional() @IsInt() @Min(0) actualMinutes?: number;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() projectObjectId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssigneeInputDto)
  assignees?: AssigneeInputDto[];
}

export class UpdateTicketDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsUUID() statusId?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsInt() @Min(0) estimatedMinutes?: number;
  @IsOptional() @IsInt() @Min(0) actualMinutes?: number;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() projectObjectId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssigneeInputDto)
  assignees?: AssigneeInputDto[];
}

/** Déplacement / redimensionnement dans le planning (drag & drop). */
export class MoveTicketDto {
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;

  /** Réassignation implicite lors d'un glisser vers la ligne d'une autre personne. */
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsUUID() previousAssigneeId?: string;
}

export class DuplicateTicketDto {
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsBoolean() keepAssignees?: boolean;
}

export class TicketQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsUUID() statusId?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() projectObjectId?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsBoolean() includeArchived?: boolean;
  @IsOptional() @IsBoolean() unscheduled?: boolean;
  @IsOptional() @IsInt() @Min(1) take?: number;
  @IsOptional() @IsInt() @Min(0) skip?: number;
}
