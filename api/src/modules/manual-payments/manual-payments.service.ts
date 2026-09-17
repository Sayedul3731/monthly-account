import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  asPlain,
  asPlainList,
  notDeleted,
} from '../../infrastructure/database/schema.helpers';
import { BillingInterval } from '../memberships/billing-interval.enum';
import {
  Membership,
  MembershipDocument,
} from '../memberships/membership.schema';
import { MembershipType } from '../memberships/membership-type.enum';
import { User, UserDocument } from '../users/user.schema';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { ReviewManualPaymentDto } from './dto/review-manual-payment.dto';
import { ManualPayment, ManualPaymentDocument } from './manual-payment.schema';
import { ManualPaymentStatus } from './manual-payment-status.enum';

const PAYMENT_POPULATE = ['user', 'membership', 'reviewedBy'] as const;
const REVIEW_ORDER: Record<ManualPaymentStatus, number> = {
  [ManualPaymentStatus.PENDING]: 0,
  [ManualPaymentStatus.REJECTED]: 1,
  [ManualPaymentStatus.APPROVED]: 2,
};

@Injectable()
export class ManualPaymentsService {
  constructor(
    @InjectModel(ManualPayment.name)
    private readonly manualPaymentModel: Model<ManualPaymentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
  ) {}

  async findMine(userId: string): Promise<ManualPayment[]> {
    const payments = await this.manualPaymentModel
      .find(notDeleted({ userId: new Types.ObjectId(userId) }))
      .populate(['membership', 'reviewedBy'])
      .sort({ createdAt: -1 })
      .exec();
    return asPlainList<ManualPayment>(payments);
  }

  async findAll(): Promise<ManualPayment[]> {
    const payments = await this.manualPaymentModel
      .find(notDeleted())
      .populate([...PAYMENT_POPULATE])
      .sort({ createdAt: -1 })
      .exec();
    payments.sort(
      (left, right) => REVIEW_ORDER[left.status] - REVIEW_ORDER[right.status],
    );
    return asPlainList<ManualPayment>(payments);
  }

  async create(
    userId: string,
    dto: CreateManualPaymentDto,
  ): Promise<ManualPayment> {
    const [user, membership] = await Promise.all([
      this.findUser(userId),
      this.findPaidMembership(dto.membershipId),
    ]);
    const amount = this.priceFor(membership, dto.billingInterval);
    if (amount <= 0) {
      throw new BadRequestException(
        'This paid plan does not have a valid price',
      );
    }

    const existingPending = await this.manualPaymentModel
      .findOne(
        notDeleted({
          userId: user._id,
          status: ManualPaymentStatus.PENDING,
        }),
      )
      .exec();
    if (existingPending) {
      throw new ConflictException(
        'You already have a payment awaiting review. Please wait for an admin decision.',
      );
    }

    const transactionId = dto.transactionId.trim().toUpperCase();
    const alreadySubmitted = await this.manualPaymentModel
      .findOne(notDeleted({ transactionId }))
      .exec();
    if (alreadySubmitted) {
      throw new ConflictException(
        'This Nagad transaction ID has already been submitted',
      );
    }

    try {
      const payment = await this.manualPaymentModel.create({
        userId: user._id,
        membershipId: membership._id,
        billingInterval: dto.billingInterval,
        amount,
        transactionId,
        status: ManualPaymentStatus.PENDING,
      });
      return this.findOne(payment.id);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'This Nagad transaction ID has already been submitted',
        );
      }
      throw error;
    }
  }

  async review(
    id: string,
    reviewerId: string,
    dto: ReviewManualPaymentDto,
  ): Promise<ManualPayment> {
    const payment = await this.manualPaymentModel
      .findOne(notDeleted({ _id: id }))
      .exec();
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    if (payment.status !== ManualPaymentStatus.PENDING) {
      throw new ConflictException('This payment has already been reviewed');
    }

    if (dto.status === ManualPaymentStatus.APPROVED) {
      await Promise.all([
        this.findUser(payment.userId.toString()),
        this.findPaidMembership(payment.membershipId.toString()),
      ]);
    }

    const reviewedAt = new Date();
    const planDates =
      dto.status === ManualPaymentStatus.APPROVED
        ? await this.createPlanDates(
            payment.userId,
            payment.billingInterval,
            reviewedAt,
          )
        : { planStartedAt: null, planEndsAt: null };
    const reviewed = await this.manualPaymentModel
      .findOneAndUpdate(
        notDeleted({ _id: id, status: ManualPaymentStatus.PENDING }),
        {
          status: dto.status,
          reviewedById: new Types.ObjectId(reviewerId),
          reviewedAt,
          reviewNote: dto.reviewNote?.trim() || null,
          ...planDates,
        },
        { new: true },
      )
      .exec();
    if (!reviewed) {
      throw new ConflictException('This payment has already been reviewed');
    }

    if (dto.status === ManualPaymentStatus.APPROVED) {
      const result = await this.userModel
        .updateOne(notDeleted({ _id: reviewed.userId }), {
          membershipId: reviewed.membershipId,
          billingInterval: reviewed.billingInterval,
        })
        .exec();
      if (!result.matchedCount) {
        throw new NotFoundException(
          `User ${reviewed.userId.toString()} not found`,
        );
      }
    }

    return this.findOne(id);
  }

  async findOne(id: string): Promise<ManualPayment> {
    const payment = await this.manualPaymentModel
      .findOne(notDeleted({ _id: id }))
      .populate([...PAYMENT_POPULATE])
      .exec();
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return asPlain<ManualPayment>(payment);
  }

  private async findUser(id: string): Promise<UserDocument> {
    const user = await this.userModel.findOne(notDeleted({ _id: id })).exec();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  private async findPaidMembership(id: string): Promise<MembershipDocument> {
    const membership = await this.membershipModel
      .findOne(notDeleted({ _id: id, type: MembershipType.PAID }))
      .exec();
    if (!membership)
      throw new NotFoundException(`Paid membership ${id} not found`);
    return membership;
  }

  private priceFor(membership: Membership, interval: BillingInterval): number {
    if (interval === BillingInterval.QUARTERLY)
      return membership.quarterlyPrice;
    if (interval === BillingInterval.YEARLY) return membership.yearlyPrice;
    return membership.monthlyPrice;
  }

  private async createPlanDates(
    userId: Types.ObjectId,
    interval: BillingInterval,
    now: Date,
  ): Promise<{ planStartedAt: Date; planEndsAt: Date }> {
    const activePayment = await this.manualPaymentModel
      .findOne(
        notDeleted({
          userId,
          status: ManualPaymentStatus.APPROVED,
          planEndsAt: { $gt: now },
        }),
      )
      .sort({ planEndsAt: -1 })
      .exec();
    const planStartedAt =
      activePayment?.planEndsAt && activePayment.planEndsAt > now
        ? activePayment.planEndsAt
        : now;
    const months =
      interval === BillingInterval.YEARLY
        ? 12
        : interval === BillingInterval.QUARTERLY
          ? 3
          : 1;

    return {
      planStartedAt,
      planEndsAt: this.addCalendarMonths(planStartedAt, months),
    };
  }

  private addCalendarMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const lastDay = new Date(
      Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
    ).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
