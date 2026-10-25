import { AccessScope } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertAgentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  persona?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(AccessScope)
  visibility?: AccessScope;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}

export class PatchAgentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  persona?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(AccessScope)
  visibility?: AccessScope;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}
