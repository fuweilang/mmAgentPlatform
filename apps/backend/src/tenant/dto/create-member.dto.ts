import { IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { MemberRole } from '@prisma/client';

export class CreateMemberDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Matches(/^1\d{10}$/, { message: '请输入正确的手机号' })
  phone!: string;

  @IsString()
  password!: string;

  @IsEnum(MemberRole)
  role!: MemberRole;
}
