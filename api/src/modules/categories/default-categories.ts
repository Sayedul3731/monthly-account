import { TransactionType } from '../transactions/transaction-type.enum';

export const DEFAULT_CATEGORIES: Array<{
  name: string;
  type: TransactionType;
  icon: string;
}> = [
  { name: 'Salary', type: TransactionType.INCOME, icon: '💼' },
  { name: 'Freelance', type: TransactionType.INCOME, icon: '🖥️' },
  { name: 'Investment', type: TransactionType.INCOME, icon: '📈' },
  { name: 'Gift', type: TransactionType.INCOME, icon: '🎁' },
  { name: 'Other', type: TransactionType.INCOME, icon: '📌' },
  { name: 'Food', type: TransactionType.EXPENSE, icon: '🍽️' },
  { name: 'Transport', type: TransactionType.EXPENSE, icon: '🚗' },
  { name: 'Bills', type: TransactionType.EXPENSE, icon: '📄' },
  { name: 'Shopping', type: TransactionType.EXPENSE, icon: '🛍️' },
  { name: 'Health', type: TransactionType.EXPENSE, icon: '💊' },
  { name: 'Entertainment', type: TransactionType.EXPENSE, icon: '🎬' },
  { name: 'Other', type: TransactionType.EXPENSE, icon: '📌' },
];
