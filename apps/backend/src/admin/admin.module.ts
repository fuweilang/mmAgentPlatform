import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminUserController } from './admin-user.controller';
import { AdminEnterpriseController } from './admin-enterprise.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminUserController, AdminEnterpriseController],
  providers: [AdminService],
})
export class AdminModule {}