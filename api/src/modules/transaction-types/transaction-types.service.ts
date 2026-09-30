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
import { Transaction } from '../transactions/transaction.schema';
import { DEFAULT_TRANSACTION_TYPES } from './default-transaction-types';
import { CreateTransactionTypeDto } from './dto/create-transaction-type.dto';
import { UpdateTransactionTypeDto } from './dto/update-transaction-type.dto';
import {
  TransactionTypeDocument,
  TransactionTypeEntity,
} from './transaction-type.schema';

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class TransactionTypesService implements OnModuleInit {
  private readonly logger = new Logger(TransactionTypesService.name);
  private cache: { expiresAt: number; items: TransactionTypeEntity[] } | null = null;

  constructor(
    @InjectModel(TransactionTypeEntity.name)
    private readonly transactionTypeModel: Model<TransactionTypeDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultTypes();
    // Warm the catalog during application startup so the first form does not
    // have to wait for a database round trip.
    await this.findAll();
  }

  async findAll(): Promise<TransactionTypeEntity[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.items;

    const docs = await this.transactionTypeModel
      .find(notDeleted())
      .sort({ name: 1 })
      .exec();
    const items = asPlainList<TransactionTypeEntity>(docs);
    this.cache = { items, expiresAt: now + CATALOG_CACHE_TTL_MS };
    return items;
  }

  async findOne(id: string): Promise<TransactionTypeEntity> {
    return asPlain<TransactionTypeEntity>(await this.getDocument(id));
  }

  async create(dto: CreateTransactionTypeDto): Promise<TransactionTypeEntity> {
    const name = dto.name.trim();
    await this.ensureNameAvailable(name);

    const transactionType = await this.transactionTypeModel.create({
      name,
      label: dto.label.trim(),
      icon: dto.icon ?? '',
    });

    this.clearCache();
    return asPlain<TransactionTypeEntity>(transactionType);
  }

  async update(
    id: string,
    dto: UpdateTransactionTypeDto,
  ): Promise<TransactionTypeEntity> {
    const transactionType = await this.getDocument(id);

    if (dto.name !== undefined && dto.name.trim() !== transactionType.name) {
      await this.ensureNameAvailable(dto.name.trim(), id);
      transactionType.name = dto.name.trim();
    }

    if (dto.label !== undefined) transactionType.label = dto.label.trim();
    if (dto.icon !== undefined) transactionType.icon = dto.icon;

    const updated = asPlain<TransactionTypeEntity>(await transactionType.save());
    this.clearCache();
    return updated;
  }

  async remove(id: string): Promise<void> {
    const inUse = await this.transactionModel
      .exists({ transactionTypeId: new Types.ObjectId(id) })
      .exec();

    if (inUse) {
      throw new ConflictException(
        'Transaction type is in use by transactions and cannot be deleted',
      );
    }

    const result = await this.transactionTypeModel
      .updateOne(notDeleted({ _id: id }), { deletedAt: new Date() })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`Transaction type ${id} not found`);
    }
    this.clearCache();
  }

  private async getDocument(id: string): Promise<TransactionTypeDocument> {
    const transactionType = await this.transactionTypeModel
      .findOne(notDeleted({ _id: id }))
      .exec();

    if (!transactionType) {
      throw new NotFoundException(`Transaction type ${id} not found`);
    }

    return transactionType;
  }

  private async ensureNameAvailable(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.transactionTypeModel
      .findOne(notDeleted({ name }))
      .exec();

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Transaction type "${name}" already exists`);
    }
  }

  private clearCache(): void {
    this.cache = null;
  }

  private async ensureDefaultTypes(): Promise<void> {
    const result = await this.transactionTypeModel.bulkWrite(
      DEFAULT_TRANSACTION_TYPES.map((seed) => ({
        updateOne: {
          filter: notDeleted({ name: seed.name }),
          update: { $setOnInsert: seed },
          upsert: true,
        },
      })),
    );

    if (result.upsertedCount) {
      this.logger.log(`Seeded ${result.upsertedCount} default transaction type(s)`);
    }
  }
}
