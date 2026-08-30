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
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../../shared/pipes/parse-object-id.pipe';
import { DefaultRole } from '../roles/app-role.schema';
import { CreateTransactionTypeDto } from './dto/create-transaction-type.dto';
import { UpdateTransactionTypeDto } from './dto/update-transaction-type.dto';
import { TransactionTypeEntity } from './transaction-type.schema';
import { TransactionTypesService } from './transaction-types.service';

@ApiTags('transaction-types')
@ApiBearerAuth()
@Controller('transaction-types')
export class TransactionTypesController {
  constructor(
    private readonly transactionTypesService: TransactionTypesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List transaction types' })
  @ApiOkResponse({ type: TransactionTypeEntity, isArray: true })
  findAll() {
    return this.transactionTypesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction type by ID' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: TransactionTypeEntity })
  @ApiNotFoundResponse({ description: 'Transaction type not found' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.transactionTypesService.findOne(id);
  }

  @Post()
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'Create a transaction type' })
  @ApiOkResponse({ type: TransactionTypeEntity })
  create(@Body() dto: CreateTransactionTypeDto) {
    return this.transactionTypesService.create(dto);
  }

  @Patch(':id')
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'Update a transaction type' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: TransactionTypeEntity })
  @ApiNotFoundResponse({ description: 'Transaction type not found' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateTransactionTypeDto,
  ) {
    return this.transactionTypesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(DefaultRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a transaction type' })
  @ApiParam({ name: 'id' })
  @ApiNoContentResponse({ description: 'Transaction type deleted' })
  @ApiNotFoundResponse({ description: 'Transaction type not found' })
  @ApiConflictResponse({
    description: 'Transaction type is in use by transactions',
  })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.transactionTypesService.remove(id);
  }
}
