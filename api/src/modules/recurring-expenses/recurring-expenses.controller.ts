import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/jwt-payload.interface';
import { ParseObjectIdPipe } from '../../shared/pipes/parse-object-id.pipe';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';
import { RecurringExpense } from './recurring-expense.schema';
import { RecurringExpensesService } from './recurring-expenses.service';

@ApiTags('recurring-expenses')
@ApiBearerAuth()
@Controller('recurring-expenses')
export class RecurringExpensesController {
  constructor(
    private readonly recurringExpensesService: RecurringExpensesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List the current user's recurring expense schedules",
  })
  @ApiOkResponse({ type: RecurringExpense, isArray: true })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.recurringExpensesService.findAll(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a recurring monthly expense schedule' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringExpenseDto,
  ) {
    return this.recurringExpensesService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update or pause a recurring expense schedule' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRecurringExpenseDto,
  ) {
    return this.recurringExpensesService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a recurring expense schedule' })
  @ApiNoContentResponse()
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recurringExpensesService.remove(id, user.userId);
  }
}
