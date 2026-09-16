import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BillingInterval } from '../../../modules/memberships/billing-interval.enum';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Plaintext password. The API bcrypt-hashes this value before storage. Changing the password revokes active refresh tokens.',
    example: 'password123',
    minLength: 8,
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password?: string;

  @ApiPropertyOptional({
    description: 'Required when changing the password.',
    minLength: 8,
    maxLength: 72,
  })
  @ValidateIf((dto: UpdateProfileDto) => dto.password !== undefined)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword?: string;

  @ApiPropertyOptional({
    description: 'Membership plan to switch to.',
  })
  @IsOptional()
  @IsMongoId()
  membershipId?: string;

  @ApiPropertyOptional({
    enum: BillingInterval,
    description:
      'Monthly, quarterly, or yearly billing. Required for the paid plan.',
  })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;
}
