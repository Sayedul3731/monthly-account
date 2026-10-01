import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionType } from '../transactions/transaction-type.enum';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';

const DHAKA_TIME_ZONE = 'Asia/Dhaka';

type Month = { year: number; month: number };

@Injectable()
export class MonthlySummariesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Creates the prior month's summary for every account with activity. */
  async publishPreviousMonth(now = new Date()): Promise<{ created: number }> {
    const current = this.monthInDhaka(now);
    const previous = this.previousMonth(current);
    return this.publishForMonth(previous.year, previous.month);
  }

  async publishForMonth(
    year: number,
    month: number,
  ): Promise<{ created: number }> {
    const users = await this.usersService.findAll();
    const period = `${year}-${String(month + 1).padStart(2, '0')}`;
    let created = 0;

    for (const user of users) {
      const [transactions, previousTransactions] = await Promise.all([
        this.transactionsService.findAll(user.id, year, month),
        this.transactionsService.findAll(
          user.id,
          this.previousMonth({ year, month }).year,
          this.previousMonth({ year, month }).month,
        ),
      ]);

      // Avoid an empty monthly report for accounts that had no ledger activity.
      if (!transactions.length) continue;

      const createdForUser =
        await this.notificationsService.createMonthlySummary({
          userId: user.id,
          period,
          title: `${this.monthName(year, month)}ের হিসাব প্রস্তুত 🎉`,
          message: this.buildMessage(transactions, previousTransactions),
          link: '/',
        });
      if (createdForUser) created += 1;
    }

    return { created };
  }

  private buildMessage(
    transactions: Awaited<ReturnType<TransactionsService['findAll']>>,
    previousTransactions: Awaited<ReturnType<TransactionsService['findAll']>>,
  ): string {
    const income = this.total(transactions, TransactionType.INCOME);
    const expenses = this.total(transactions, TransactionType.EXPENSE);
    const previousExpenses = this.total(
      previousTransactions,
      TransactionType.EXPENSE,
    );
    const largestExpense = this.largestExpense(transactions);

    return [
      `মোট আয়: ${this.currency(income)}`,
      `মোট খরচ: ${this.currency(expenses)}`,
      `সঞ্চয়: ${this.currency(income - expenses)}`,
      '',
      'সবচেয়ে বেশি খরচ:',
      largestExpense
        ? `${largestExpense.icon} ${largestExpense.category} — ${this.currency(largestExpense.amount)}`
        : 'কোনো খরচ নেই',
      '',
      'গত মাসের তুলনায়:',
      this.expenseChange(expenses, previousExpenses),
    ].join('\n');
  }

  private total(
    transactions: Awaited<ReturnType<TransactionsService['findAll']>>,
    type: TransactionType,
  ): number {
    return transactions
      .filter((transaction) => transaction.transactionType?.name === type)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  private largestExpense(
    transactions: Awaited<ReturnType<TransactionsService['findAll']>>,
  ): { category: string; icon: string; amount: number } | null {
    const totals = new Map<string, { icon: string; amount: number }>();
    for (const transaction of transactions) {
      if (transaction.transactionType?.name !== TransactionType.EXPENSE)
        continue;
      const category = transaction.category?.name ?? 'অন্যান্য';
      const current = totals.get(category) ?? {
        icon: transaction.category?.icon || '📌',
        amount: 0,
      };
      current.amount += transaction.amount;
      totals.set(category, current);
    }

    const largest = [...totals.entries()].sort(
      ([, first], [, second]) => second.amount - first.amount,
    )[0];
    return largest
      ? {
          category: largest[0],
          icon: largest[1].icon,
          amount: largest[1].amount,
        }
      : null;
  }

  private expenseChange(expenses: number, previousExpenses: number): string {
    if (previousExpenses === 0) {
      return expenses === 0 ? 'খরচ অপরিবর্তিত আছে' : 'আগের মাসে খরচ ছিল না';
    }
    const percentage = Math.round(
      (Math.abs(expenses - previousExpenses) / previousExpenses) * 100,
    );
    if (expenses < previousExpenses) return `খরচ ${percentage}% কমেছে`;
    if (expenses > previousExpenses) return `খরচ ${percentage}% বেড়েছে`;
    return 'খরচ অপরিবর্তিত আছে';
  }

  private currency(amount: number): string {
    return `৳${new Intl.NumberFormat('en-BD', {
      maximumFractionDigits: 2,
    }).format(Math.abs(amount))}`;
  }

  private monthName(year: number, month: number): string {
    return new Intl.DateTimeFormat('bn-BD', { month: 'long' }).format(
      new Date(Date.UTC(year, month, 1)),
    );
  }

  private monthInDhaka(date: Date): Month {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: DHAKA_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(date);
    return {
      year: Number(parts.find((part) => part.type === 'year')?.value),
      month: Number(parts.find((part) => part.type === 'month')?.value) - 1,
    };
  }

  private previousMonth({ year, month }: Month): Month {
    return month === 0
      ? { year: year - 1, month: 11 }
      : { year, month: month - 1 };
  }
}
