import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/jwt-payload.interface';
import { ParseObjectIdPipe } from '../../shared/pipes/parse-object-id.pipe';
import { BudgetQueryDto, UpsertBudgetDto } from './dto/upsert-budget.dto';
import { Budget } from './budget.schema';
import { BudgetsService } from './budgets.service';

@ApiTags('budgets')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'List budgets for a month' })
  @ApiOkResponse({ type: Budget, isArray: true })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BudgetQueryDto,
  ) {
    return this.budgetsService.findAll(user.userId, query.year, query.month);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a budget' })
  @ApiOkResponse({ type: Budget })
  upsert(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertBudgetDto) {
    return this.budgetsService.upsert(user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiParam({ name: 'id' })
  @ApiNoContentResponse({ description: 'Budget deleted' })
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetsService.remove(id, user.userId);
  }
}
