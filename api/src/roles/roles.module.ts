import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppRole, AppRoleSchema } from './app-role.schema';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AppRole.name, schema: AppRoleSchema }]),
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
