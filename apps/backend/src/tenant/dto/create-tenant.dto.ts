import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { TenantType } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsEnum(TenantType)
  type!: TenantType;

  @IsOptional()
  @IsString()
  parentId?: string;
}
