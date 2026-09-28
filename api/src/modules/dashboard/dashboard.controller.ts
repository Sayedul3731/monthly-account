import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/jwt-payload.interface';
import { BudgetQueryDto } from '../budgets/dto/upsert-budget.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Load the current user dashboard for a month' })
  findMonthly(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BudgetQueryDto,
  ) {
    return this.dashboardService.findMonthly(
      user.userId,
      query.year,
      query.month,
    );
  }
}
