import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsDateString,
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

@ValidatorConstraint({ name: 'dateRangeLimit' })
class DateRangeLimitConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const query = args.object as TransactionQueryDto;
    if (!query.start || !query.end) return true;

    const start = Date.parse(query.start);
    const end = Date.parse(query.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
    const days = (end - start) / (24 * 60 * 60 * 1000);
    return days >= 0 && days <= 366;
  }

  defaultMessage(): string {
    return 'date ranges must be ordered and no longer than 366 days';
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

  @ApiPropertyOptional({ example: '2026-05-01', format: 'date' })
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiPropertyOptional({ example: '2026-05-31', format: 'date' })
  @Validate(DateRangeLimitConstraint)
  @IsOptional()
  @IsDateString()
  end?: string;
}
