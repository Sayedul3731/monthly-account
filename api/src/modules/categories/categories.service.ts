import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  asPlain,
  asPlainList,
  notDeleted,
} from '../../infrastructure/database/schema.helpers';
import { TransactionType } from '../transactions/transaction-type.enum';
import { Transaction } from '../transactions/transaction.schema';
import { Category, CategoryDocument } from './category.schema';
import { DEFAULT_CATEGORIES } from './default-categories';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultCategories();
  }

  async findAll(type?: TransactionType): Promise<Category[]> {
    const docs = await this.categoryModel
      .find(notDeleted(type ? { type } : {}))
      .sort({ name: 1 })
      .exec();

    return asPlainList<Category>(docs);
  }

  async findOne(id: string): Promise<Category> {
    return asPlain<Category>(await this.getDocument(id));
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const name = dto.name.trim();
    await this.ensureNameAvailable(dto.type, name);

    const category = await this.categoryModel.create({
      name,
      type: dto.type,
      icon: dto.icon ?? '',
    });

    return asPlain<Category>(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.getDocument(id);
    const nextType = dto.type ?? category.type;
    const nextName = dto.name !== undefined ? dto.name.trim() : category.name;

    if (nextType !== category.type || nextName !== category.name) {
      await this.ensureNameAvailable(nextType, nextName, id);
    }

    category.type = nextType;
    category.name = nextName;
    if (dto.icon !== undefined) category.icon = dto.icon;

    return asPlain<Category>(await category.save());
  }

  async remove(id: string): Promise<void> {
    const inUse = await this.transactionModel
      .exists({ categoryId: new Types.ObjectId(id) })
      .exec();

    if (inUse) {
      throw new ConflictException(
        'Category is in use by transactions and cannot be deleted',
      );
    }

    const result = await this.categoryModel
      .updateOne(notDeleted({ _id: id }), { deletedAt: new Date() })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`Category ${id} not found`);
    }
  }

  private async getDocument(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne(notDeleted({ _id: id }))
      .exec();

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return category;
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

  private async ensureDefaultCategories(): Promise<void> {
    for (const seed of DEFAULT_CATEGORIES) {
      const existing = await this.categoryModel
        .findOne(notDeleted({ type: seed.type, name: seed.name }))
        .exec();

      if (!existing) {
        await this.categoryModel.create(seed);
        this.logger.log(`Seeded category "${seed.name}" (${seed.type})`);
      }
    }
  }
}
