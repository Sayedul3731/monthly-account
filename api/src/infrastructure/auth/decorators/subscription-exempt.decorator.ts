import { SetMetadata } from '@nestjs/common';

export const SUBSCRIPTION_EXEMPT_KEY = 'subscriptionExempt';
export const SubscriptionExempt = () =>
  SetMetadata(SUBSCRIPTION_EXEMPT_KEY, true);
