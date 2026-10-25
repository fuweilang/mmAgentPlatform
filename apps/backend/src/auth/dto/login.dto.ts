import { IsString, Matches, MinLength } from 'class-validator';

const PHONE = /^1\d{10}$/;

export class LoginDto {
  @Matches(PHONE, { message: '请输入正确的手机号' })
  phone!: string;

  @IsString()
  password!: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Matches(PHONE, { message: '请输入正确的手机号' })
  phone!: string;

  @IsString()
  password!: string;

  @IsString()
  @MinLength(1)
  enterpriseName!: string;
}

export class SwitchTenantDto {
  @IsString()
  tenantId!: string;
}

export class ConsumeBrowserSsoDto {
  @IsString()
  ticket!: string;
}
