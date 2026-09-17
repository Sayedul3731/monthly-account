import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Membership, MembershipSchema } from '../memberships/membership.schema';
import { User, UserSchema } from '../users/user.schema';
import { ManualPayment, ManualPaymentSchema } from './manual-payment.schema';
import { ManualPaymentsController } from './manual-payments.controller';
import { ManualPaymentsService } from './manual-payments.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ManualPayment.name, schema: ManualPaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
  ],
  controllers: [ManualPaymentsController],
  providers: [ManualPaymentsService],
})
export class ManualPaymentsModule {}
