import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BillingInterval } from '../../memberships/billing-interval.enum';

export class CreateManualPaymentDto {
  @ApiProperty({ description: 'Selected paid membership ID.' })
  @IsMongoId()
  membershipId!: string;

  @ApiProperty({ enum: BillingInterval })
  @IsEnum(BillingInterval)
  billingInterval!: BillingInterval;

  @ApiProperty({
    example: 'A1B2C3D4E5',
    description: 'The Nagad transaction ID from the completed payment.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'transactionId may contain only letters, numbers, and hyphens',
  })
  transactionId!: string;
}
