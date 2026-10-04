import {
  BadRequestException,
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
import { visibleCategories } from './category-access';
import { ensureCategoryOwnershipIndex } from './category-index';
import { DEFAULT_CATEGORIES } from './default-categories';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);
  private cache: { expiresAt: number; items: Category[] } | null = null;

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async onModuleInit(): Promise<void> {
    await ensureCategoryOwnershipIndex(this.categoryModel.collection);
    await this.ensureDefaultCategories();
  }

  async findAll(type?: TransactionType): Promise<Category[]> {
    const categories = await this.getCachedCategories();
    return type
      ? categories.filter((category) => category.type === type)
      : categories;
  }

  async findOne(id: string): Promise<Category> {
    return asPlain<Category>(await this.getDocument(id));
  }

  async findVisible(
    userId: string,
    type?: TransactionType,
  ): Promise<Category[]> {
    const docs = await this.categoryModel
      .find(
        notDeleted({ ...visibleCategories(userId), ...(type ? { type } : {}) }),
      )
      .sort({ name: 1 })
      .exec();
    return asPlainList<Category>(docs);
  }

  async create(dto: CreateCategoryDto, userId?: string): Promise<Category> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Enter a category name');
    await this.ensureNameAvailable(dto.type, name, undefined, userId);

    let category: CategoryDocument;
    try {
      category = await this.categoryModel.create({
        name,
        type: dto.type,
        icon: dto.icon?.trim() ?? '',
        userId: userId ? new Types.ObjectId(userId) : null,
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException(
          'A category with this name and type already exists',
        );
      }
      throw error;
    }

    this.clearCache();
    return asPlain<Category>(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.getDocument(id);
    const nextType = dto.type ?? category.type;
    const nextName = dto.name !== undefined ? dto.name.trim() : category.name;
    if (!nextName) throw new BadRequestException('Enter a category name');

    if (nextType !== category.type || nextName !== category.name) {
      await this.ensureNameAvailable(nextType, nextName, id);
    }

    category.type = nextType;
    category.name = nextName;
    if (dto.icon !== undefined) category.icon = dto.icon;

    const updated = asPlain<Category>(await category.save());
    this.clearCache();
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.getDocument(id);
    const inUse = await this.transactionModel
      .exists({ categoryId: new Types.ObjectId(id) })
      .exec();

    if (inUse) {
      throw new ConflictException(
        'Category is in use by transactions and cannot be deleted',
      );
    }

    const result = await this.categoryModel
      .updateOne(notDeleted({ _id: id, userId: null }), {
        deletedAt: new Date(),
      })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    this.clearCache();
  }

  private async getDocument(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne(notDeleted({ _id: id, userId: null }))
      .exec();

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return category;
  }

  private async getCachedCategories(): Promise<Category[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.items;

    const docs = await this.categoryModel
      .find(notDeleted({ userId: null }))
      .sort({ name: 1 })
      .exec();
    const items = asPlainList<Category>(docs);
    this.cache = { items, expiresAt: now + CATALOG_CACHE_TTL_MS };
    return items;
  }

  private clearCache(): void {
    this.cache = null;
  }

  private async ensureNameAvailable(
    type: TransactionType,
    name: string,
    excludeId?: string,
    userId?: string,
  ): Promise<void> {
    const existing = await this.categoryModel
      .findOne(
        notDeleted({
          type,
          name,
          ...(excludeId ? { _id: { $ne: excludeId } } : {}),
          ...(userId ? visibleCategories(userId) : { userId: null }),
        }),
      )
      .exec();

    if (existing) {
      throw new ConflictException(
        `Category "${name}" already exists for type "${type}"`,
      );
    }
  }

  private async ensureDefaultCategories(): Promise<void> {
    const result = await this.categoryModel.bulkWrite(
      DEFAULT_CATEGORIES.map((seed) => ({
        updateOne: {
          filter: notDeleted({
            type: seed.type,
            name: seed.name,
            userId: null,
          }),
          update: { $setOnInsert: { ...seed, userId: null } },
          upsert: true,
        },
      })),
    );

    if (result.upsertedCount) {
      this.logger.log(`Seeded ${result.upsertedCount} default category(s)`);
    }
  }
}
