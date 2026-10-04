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
  Query,
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
import { Public } from '../../infrastructure/auth/decorators/public.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/jwt-payload.interface';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { SubscriptionExempt } from '../../infrastructure/auth/decorators/subscription-exempt.decorator';
import { ParseObjectIdPipe } from '../../shared/pipes/parse-object-id.pipe';
import { DefaultRole } from '../roles/app-role.schema';
import { CategoriesService } from './categories.service';
import { Category } from './category.schema';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
@SubscriptionExempt()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List categories, optionally filtered by type' })
  @ApiOkResponse({ type: Category, isArray: true })
  findAll(@Query() query: CategoryQueryDto) {
    return this.categoriesService.findAll(query.type);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'List shared categories and your personal categories',
  })
  @ApiOkResponse({ type: Category, isArray: true })
  findVisible(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CategoryQueryDto,
  ) {
    return this.categoriesService.findVisible(user.userId, query.type);
  }

  @Post('mine')
  @ApiOperation({ summary: 'Create a personal category for your account' })
  @ApiOkResponse({ type: Category })
  @ApiConflictResponse({ description: 'Category name already exists' })
  createPersonal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(dto, user.userId);
  }

  @Patch('mine/:id')
  @ApiOperation({ summary: 'Update one of your personal categories' })
  updatePersonal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto, user.userId);
  }

  @Delete('mine/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused personal category' })
  removePersonal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.categoriesService.remove(id, user.userId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: Category })
  @ApiNotFoundResponse({ description: 'Category not found' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'Create a category' })
  @ApiOkResponse({ type: Category })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: Category })
  @ApiNotFoundResponse({ description: 'Category not found' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(DefaultRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id' })
  @ApiNoContentResponse({ description: 'Category deleted' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({ description: 'Category is in use by transactions' })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
