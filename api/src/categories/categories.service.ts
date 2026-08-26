import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { notDeleted } from '../common/schemas/schema.helpers';
import { TransactionType } from '../transactions/transaction-type.enum';
import { Category, CategoryDocument } from './category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  findAll(type?: TransactionType): Promise<Category[]> {
    return this.categoryModel
      .find(notDeleted(type ? { type } : {}))
      .sort({ name: 1 })
      .exec();
  }

  async findOne(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne(notDeleted({ _id: id }))
      .exec();

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return category;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    await this.ensureNameAvailable(dto.type, dto.name);

    return this.categoryModel.create({
      name: dto.name,
      type: dto.type,
      icon: dto.icon ?? '',
    });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    const category = await this.findOne(id);
    const nextType = dto.type ?? category.type;
    const nextName = dto.name ?? category.name;

    if (nextType !== category.type || nextName !== category.name) {
      await this.ensureNameAvailable(nextType, nextName, id);
    }

    category.type = nextType;
    category.name = nextName;
    if (dto.icon !== undefined) category.icon = dto.icon;

    return category.save();
  }

  async remove(id: string): Promise<void> {
    const result = await this.categoryModel
      .updateOne(notDeleted({ _id: id }), { deletedAt: new Date() })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`Category ${id} not found`);
    }
  }

  private async ensureNameAvailable(
    type: TransactionType,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.categoryModel
      .findOne(notDeleted({ type, name }))
      .exec();

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Category "${name}" already exists for type "${type}"`,
      );
    }
  }
}
