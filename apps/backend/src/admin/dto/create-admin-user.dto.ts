import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Matches(/^1\d{10}$/, { message: '请输入正确的手机号' })
  phone!: string;

  @IsString()
  @MinLength(1, { message: '请输入密码' })
  password!: string;

  @IsBoolean()
  isPlatformAdmin!: boolean;

  @IsOptional()
  @IsString()
  tenantId?: string;
}