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
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ParseObjectIdPipe } from '../../shared/pipes/parse-object-id.pipe';
import { CategoriesService } from './categories.service';
import { Category } from './category.schema';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories, optionally filtered by type' })
  @ApiOkResponse({ type: Category, isArray: true })
  findAll(@Query() query: CategoryQueryDto) {
    return this.categoriesService.findAll(query.type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: Category })
  @ApiNotFoundResponse({ description: 'Category not found' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  @ApiOkResponse({ type: Category })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
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
