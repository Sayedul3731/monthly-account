import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../infrastructure/auth/auth.module';
import configuration from '../infrastructure/config/configuration';
import { ENV_FILE_PATH } from '../infrastructure/config/env.loader';
import { DatabaseModule } from '../infrastructure/database/database.module';
import { BudgetsModule } from '../modules/budgets/budgets.module';
import { CategoriesModule } from '../modules/categories/categories.module';
import { MembershipsModule } from '../modules/memberships/memberships.module';
import { RolesModule } from '../modules/roles/roles.module';
import { TransactionTypesModule } from '../modules/transaction-types/transaction-types.module';
import { TransactionsModule } from '../modules/transactions/transactions.module';
import { UsersModule } from '../modules/users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATH,
      load: [configuration],
    }),
    DatabaseModule,
    TransactionsModule,
    BudgetsModule,
    UsersModule,
    CategoriesModule,
    MembershipsModule,
    TransactionTypesModule,
    RolesModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
