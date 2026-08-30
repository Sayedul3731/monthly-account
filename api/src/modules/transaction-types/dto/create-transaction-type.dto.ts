import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTransactionTypeDto {
  @ApiProperty({ example: 'income', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'Income', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @ApiPropertyOptional({ example: '💰', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;
}
