import { Injectable } from '@nestjs/common';
import { BudgetsService } from '../budgets/budgets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly budgetsService: BudgetsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findMonthly(userId: string, year: number, month: number) {
    const [transactions, budgets, unreadNotificationCount] = await Promise.all([
      this.transactionsService.findAll(userId, year, month),
      this.budgetsService.findAll(userId, year, month),
      this.notificationsService.countUnread(userId),
    ]);

    return { transactions, budgets, unreadNotificationCount };
  }
}
