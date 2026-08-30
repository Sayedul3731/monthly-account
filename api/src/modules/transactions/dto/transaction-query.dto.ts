import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Max,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'yearMonthTogether' })
class YearMonthTogetherConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const query = args.object as TransactionQueryDto;
    return (query.year === undefined) === (query.month === undefined);
  }

  defaultMessage(): string {
    return 'year and month must be provided together';
  }
}

export class TransactionQueryDto {
  @ApiPropertyOptional({ example: 2026, minimum: 2000, maximum: 2100 })
  @Validate(YearMonthTogetherConstraint)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    example: 5,
    minimum: 0,
    maximum: 11,
    description: 'Zero-based month (0 = January)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(11)
  month?: number;
}
