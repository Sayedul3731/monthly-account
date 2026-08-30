import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsMongoId,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BillingInterval } from '../../memberships/billing-interval.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'jane@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description:
      'Plaintext password. The API bcrypt-hashes this value before storage.',
    example: 'password123',
    minLength: 8,
    maxLength: 64,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiPropertyOptional({
    description: 'Role to assign. Defaults to the "user" role if omitted.',
  })
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional({
    description:
      'Membership to assign. Defaults to the free membership if omitted.',
  })
  @IsOptional()
  @IsMongoId()
  membershipId?: string;

  @ApiPropertyOptional({
    enum: BillingInterval,
    description: 'Required when assigning a paid membership.',
  })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;
}
