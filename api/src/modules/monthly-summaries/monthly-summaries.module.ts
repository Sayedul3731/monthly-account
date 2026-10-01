import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { MonthlySummariesController } from './monthly-summaries.controller';
import { MonthlySummariesService } from './monthly-summaries.service';

@Module({
  imports: [UsersModule, TransactionsModule, NotificationsModule],
  controllers: [MonthlySummariesController],
  providers: [MonthlySummariesService],
})
export class MonthlySummariesModule {}
