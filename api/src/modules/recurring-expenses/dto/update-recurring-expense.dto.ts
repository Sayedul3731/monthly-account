import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateRecurringExpenseDto } from './create-recurring-expense.dto';

export class UpdateRecurringExpenseDto extends PartialType(
  CreateRecurringExpenseDto,
) {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}
