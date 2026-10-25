import { IsOptional, IsString } from 'class-validator';

export class ListAdminUsersDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  /** `admin` = 平台管理员；`user` = 普通用户。 */
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  status?: string;
}