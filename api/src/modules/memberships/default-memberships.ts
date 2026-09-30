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
    name: '15-day Trial',
    type: MembershipType.FREE,
    description: 'Full access for 15 days. Upgrade to Premium to continue.',
    monthlyPrice: 0,
    quarterlyPrice: 0,
    yearlyPrice: 0,
  },
  {
    name: 'Premium',
    type: MembershipType.PAID,
    description: 'Premium access with priority support and extra capacity.',
    monthlyPrice: 69,
    quarterlyPrice: 177,
    yearlyPrice: 660,
  },
];
