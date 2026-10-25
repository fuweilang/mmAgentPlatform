import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateUsageEventDto {
  @IsIn(['chat_turn'])
  kind!: 'chat_turn';
}

export class PatchQuotaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000000)
  monthlyTurns?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  monthlyTokens?: number;
}
