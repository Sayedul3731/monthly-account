import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TransactionType } from '../../transactions/transaction-type.enum';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Food', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiPropertyOptional({ example: '🍔', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;
}
