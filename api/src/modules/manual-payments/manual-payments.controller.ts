import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/jwt-payload.interface';
import { ParseObjectIdPipe } from '../../shared/pipes/parse-object-id.pipe';
import { DefaultRole } from '../roles/app-role.schema';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { ReviewManualPaymentDto } from './dto/review-manual-payment.dto';
import { ManualPayment } from './manual-payment.schema';
import { ManualPaymentsService } from './manual-payments.service';

@ApiTags('manual-payments')
@ApiBearerAuth()
@Controller('manual-payments')
export class ManualPaymentsController {
  constructor(
    private readonly manualPaymentsService: ManualPaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get public manual-payment instructions' })
  settings() {
    const nagadNumber = this.config
      .get<string>('payments.nagadNumber', '')
      .trim();
    return { nagadNumber: nagadNumber || null };
  }

  @Get('mine')
  @ApiOperation({
    summary: "List the current user's manual payment submissions",
  })
  @ApiOkResponse({ type: ManualPayment, isArray: true })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.manualPaymentsService.findMine(user.userId);
  }

  @Get()
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'List manual payments for admin review' })
  @ApiOkResponse({ type: ManualPayment, isArray: true })
  findAll() {
    return this.manualPaymentsService.findAll();
  }

  @Post()
  @ApiOperation({
    summary: 'Submit a Nagad transaction ID for a selected plan',
  })
  @ApiOkResponse({ type: ManualPayment })
  @ApiConflictResponse({
    description: 'A pending payment or transaction ID already exists',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateManualPaymentDto,
  ) {
    return this.manualPaymentsService.create(user.userId, dto);
  }

  @Patch(':id/review')
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'Approve or reject a manual payment' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ManualPayment })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiConflictResponse({ description: 'Payment has already been reviewed' })
  review(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() reviewer: AuthenticatedUser,
    @Body() dto: ReviewManualPaymentDto,
  ) {
    return this.manualPaymentsService.review(id, reviewer.userId, dto);
  }
}
