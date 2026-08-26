import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { notDeleted } from '../common/schemas/schema.helpers';
import { CreateTransactionTypeDto } from './dto/create-transaction-type.dto';
import { UpdateTransactionTypeDto } from './dto/update-transaction-type.dto';
import {
  TransactionTypeDocument,
  TransactionTypeEntity,
} from './transaction-type.schema';

@Injectable()
export class TransactionTypesService {
  constructor(
    @InjectModel(TransactionTypeEntity.name)
    private readonly transactionTypeModel: Model<TransactionTypeDocument>,
  ) {}

  findAll(): Promise<TransactionTypeEntity[]> {
    return this.transactionTypeModel
      .find(notDeleted())
      .sort({ name: 1 })
      .exec();
  }

  async findOne(id: string): Promise<TransactionTypeDocument> {
    const transactionType = await this.transactionTypeModel
      .findOne(notDeleted({ _id: id }))
      .exec();

    if (!transactionType) {
      throw new NotFoundException(`Transaction type ${id} not found`);
    }

    return transactionType;
  }

  async create(
    dto: CreateTransactionTypeDto,
  ): Promise<TransactionTypeDocument> {
    await this.ensureNameAvailable(dto.name);

    return this.transactionTypeModel.create({
      name: dto.name,
      label: dto.label,
      icon: dto.icon ?? '',
    });
  }

  async update(
    id: string,
    dto: UpdateTransactionTypeDto,
  ): Promise<TransactionTypeDocument> {
    const transactionType = await this.findOne(id);

    if (dto.name !== undefined && dto.name !== transactionType.name) {
      await this.ensureNameAvailable(dto.name, id);
      transactionType.name = dto.name;
    }

    if (dto.label !== undefined) transactionType.label = dto.label;
    if (dto.icon !== undefined) transactionType.icon = dto.icon;

    return transactionType.save();
  }

  async remove(id: string): Promise<void> {
    const result = await this.transactionTypeModel
      .updateOne(notDeleted({ _id: id }), { deletedAt: new Date() })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`Transaction type ${id} not found`);
    }
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
}
