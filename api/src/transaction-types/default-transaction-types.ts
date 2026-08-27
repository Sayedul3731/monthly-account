import { TransactionType } from '../transactions/transaction-type.enum';

export const DEFAULT_TRANSACTION_TYPES: Array<{
  name: TransactionType;
  label: string;
  icon: string;
}> = [
  { name: TransactionType.INCOME, label: 'Income', icon: '💰' },
  { name: TransactionType.EXPENSE, label: 'Expense', icon: '💸' },
];
