import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsMongoId,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'ID from GET /transaction-types',
  })
  @IsMongoId()
  transactionTypeId: string;

  @ApiProperty({
    description: 'ID from GET /categories',
  })
  @IsMongoId()
  categoryId: string;

  @ApiProperty({ example: 49.99, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Weekly groceries', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiProperty({ example: '2026-06-15', format: 'date' })
  @IsDateString()
  date: string;
}
