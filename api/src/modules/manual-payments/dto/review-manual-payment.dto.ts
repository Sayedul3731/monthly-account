import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ManualPaymentStatus } from '../manual-payment-status.enum';

export class ReviewManualPaymentDto {
  @ApiProperty({
    enum: [ManualPaymentStatus.APPROVED, ManualPaymentStatus.REJECTED],
  })
  @IsEnum([ManualPaymentStatus.APPROVED, ManualPaymentStatus.REJECTED])
  status!: ManualPaymentStatus.APPROVED | ManualPaymentStatus.REJECTED;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Required when rejecting a payment.',
  })
  @ValidateIf(
    (dto: ReviewManualPaymentDto) =>
      dto.status === ManualPaymentStatus.REJECTED ||
      dto.reviewNote !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reviewNote?: string;
}
