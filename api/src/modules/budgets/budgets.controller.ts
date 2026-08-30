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
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ParseObjectIdPipe } from '../../shared/pipes/parse-object-id.pipe';
import { BudgetQueryDto, UpsertBudgetDto } from './dto/upsert-budget.dto';
import { Budget } from './budget.schema';
import { BudgetsService } from './budgets.service';

@ApiTags('budgets')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'List budgets for a month' })
  @ApiOkResponse({ type: Budget, isArray: true })
  findAll(@Query() query: BudgetQueryDto) {
    return this.budgetsService.findAll(query.year, query.month);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a budget' })
  @ApiOkResponse({ type: Budget })
  upsert(@Body() dto: UpsertBudgetDto) {
    return this.budgetsService.upsert(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiParam({ name: 'id' })
  @ApiNoContentResponse({ description: 'Budget deleted' })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.budgetsService.remove(id);
  }
}
