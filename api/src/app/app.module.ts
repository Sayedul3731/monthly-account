import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../infrastructure/auth/auth.module';
import { AuditModule } from '../modules/audit/audit.module';
import configuration from '../infrastructure/config/configuration';
import { ENV_FILE_PATH } from '../infrastructure/config/env.loader';
import { DatabaseModule } from '../infrastructure/database/database.module';
import { DashboardModule } from '../modules/dashboard/dashboard.module';
import { BudgetsModule } from '../modules/budgets/budgets.module';
import { CategoriesModule } from '../modules/categories/categories.module';
import { MembershipsModule } from '../modules/memberships/memberships.module';
import { ManualPaymentsModule } from '../modules/manual-payments/manual-payments.module';
import { MonthlySummariesModule } from '../modules/monthly-summaries/monthly-summaries.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { RolesModule } from '../modules/roles/roles.module';
import { RecurringExpensesModule } from '../modules/recurring-expenses/recurring-expenses.module';
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
    DashboardModule,
    TransactionsModule,
    BudgetsModule,
    UsersModule,
    CategoriesModule,
    MembershipsModule,
    ManualPaymentsModule,
    MonthlySummariesModule,
    NotificationsModule,
    TransactionTypesModule,
    RolesModule,
    RecurringExpensesModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
