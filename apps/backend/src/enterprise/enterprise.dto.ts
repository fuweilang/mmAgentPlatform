import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class PatchEnterpriseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  welcomeMessage?: string;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  defaultAgentId?: string | null;
}
