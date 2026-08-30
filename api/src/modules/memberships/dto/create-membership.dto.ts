import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MembershipType } from '../membership-type.enum';

export class CreateMembershipDto {
  @ApiProperty({ example: 'Free', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ enum: MembershipType, example: MembershipType.FREE })
  @IsEnum(MembershipType)
  type: MembershipType;

  @ApiPropertyOptional({
    example: 'Track income, expenses, and budgets at no cost.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 0,
    description: 'Monthly price in USD. Defaults to 0.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyPrice?: number;

  @ApiPropertyOptional({
    example: 6,
    minimum: 0,
    description: 'Yearly price in USD. Defaults to 0.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  yearlyPrice?: number;
}
