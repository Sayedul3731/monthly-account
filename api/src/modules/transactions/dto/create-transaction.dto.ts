import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsString,
  IsMongoId,
  IsOptional,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Stable ID for retrying the same creation request',
  })
  @IsOptional()
  @IsUUID('4')
  clientRequestId?: string;

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

  @ApiProperty({
    example: 'Weekly groceries',
    maxLength: 255,
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(255)
  description: string | null;

  @ApiProperty({
    example: '2026-06-15',
    format: 'date',
    description: 'Calendar date (YYYY-MM-DD)',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date: string;
}
