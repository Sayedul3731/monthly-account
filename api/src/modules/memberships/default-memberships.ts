import { MembershipType } from './membership-type.enum';

export const DEFAULT_MEMBERSHIPS: Array<{
  name: string;
  type: MembershipType;
  description: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
}> = [
  {
    name: 'Free',
    type: MembershipType.FREE,
    description: 'Track income, expenses, and budgets at no cost.',
    monthlyPrice: 0,
    quarterlyPrice: 0,
    yearlyPrice: 0,
  },
  {
    name: 'Paid',
    type: MembershipType.PAID,
    description: 'Premium access with priority support and extra capacity.',
    monthlyPrice: 49,
    quarterlyPrice: 129,
    yearlyPrice: 449,
  },
];
