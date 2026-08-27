import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { asPlain, asPlainList, notDeleted } from '../common/schemas/schema.helpers';
import { Transaction } from '../transactions/transaction.schema';
import { DEFAULT_TRANSACTION_TYPES } from './default-transaction-types';
import { CreateTransactionTypeDto } from './dto/create-transaction-type.dto';
import { UpdateTransactionTypeDto } from './dto/update-transaction-type.dto';
import {
  TransactionTypeDocument,
  TransactionTypeEntity,
} from './transaction-type.schema';

@Injectable()
export class TransactionTypesService implements OnModuleInit {
  private readonly logger = new Logger(TransactionTypesService.name);

  constructor(
    @InjectModel(TransactionTypeEntity.name)
    private readonly transactionTypeModel: Model<TransactionTypeDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultTypes();
  }

  async findAll(): Promise<TransactionTypeEntity[]> {
    const docs = await this.transactionTypeModel
      .find(notDeleted())
      .sort({ name: 1 })
      .exec();

    return asPlainList<TransactionTypeEntity>(docs);
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

    return asPlain<TransactionTypeEntity>(await transactionType.save());
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

  private async ensureDefaultTypes(): Promise<void> {
    for (const seed of DEFAULT_TRANSACTION_TYPES) {
      const existing = await this.transactionTypeModel
        .findOne(notDeleted({ name: seed.name }))
        .exec();

      if (!existing) {
        await this.transactionTypeModel.create(seed);
        this.logger.log(`Seeded transaction type "${seed.name}"`);
      }
    }
  }
}
