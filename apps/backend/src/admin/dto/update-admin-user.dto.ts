import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPlatformAdmin?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: '请输入密码' })
  password?: string;
}