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
import { User } from '../users/user.schema';
import { DEFAULT_MEMBERSHIPS } from './default-memberships';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipType } from './membership-type.enum';
import { Membership, MembershipDocument } from './membership.schema';

@Injectable()
export class MembershipsService implements OnModuleInit {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultMemberships();
  }

  async findAll(type?: MembershipType): Promise<Membership[]> {
    const docs = await this.membershipModel
      .find(notDeleted(type ? { type } : {}))
      .sort({ monthlyPrice: 1, name: 1 })
      .exec();

    return asPlainList<Membership>(docs);
  }

  async findOne(id: string): Promise<Membership> {
    return asPlain<Membership>(await this.getDocument(id));
  }

  findByType(type: MembershipType): Promise<MembershipDocument | null> {
    return this.membershipModel.findOne(notDeleted({ type })).exec();
  }

  async create(dto: CreateMembershipDto): Promise<Membership> {
    const name = dto.name.trim();
    await this.ensureNameAvailable(name);
    await this.ensureTypeAvailable(dto.type);

    const membership = await this.membershipModel.create({
      name,
      type: dto.type,
      description: dto.description ?? null,
      monthlyPrice: dto.monthlyPrice ?? 0,
      yearlyPrice: dto.yearlyPrice ?? 0,
    });

    return asPlain<Membership>(membership);
  }

  async update(id: string, dto: UpdateMembershipDto): Promise<Membership> {
    const membership = await this.getDocument(id);
    const nextName = dto.name !== undefined ? dto.name.trim() : membership.name;
    const nextType = dto.type ?? membership.type;

    if (nextName !== membership.name) {
      await this.ensureNameAvailable(nextName, id);
    }

    if (nextType !== membership.type) {
      await this.ensureTypeAvailable(nextType, id);
    }

    membership.name = nextName;
    membership.type = nextType;
    if (dto.description !== undefined) {
      membership.description = dto.description;
    }
    if (dto.monthlyPrice !== undefined) {
      membership.monthlyPrice = dto.monthlyPrice;
    }
    if (dto.yearlyPrice !== undefined) {
      membership.yearlyPrice = dto.yearlyPrice;
    }

    return asPlain<Membership>(await membership.save());
  }

  async remove(id: string): Promise<void> {
    const inUse = await this.userModel
      .exists(notDeleted({ membershipId: new Types.ObjectId(id) }))
      .exec();

    if (inUse) {
      throw new ConflictException(
        'Membership is assigned to users and cannot be deleted',
      );
    }

    const result = await this.membershipModel
      .updateOne(notDeleted({ _id: id }), { deletedAt: new Date() })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`Membership ${id} not found`);
    }
  }

  private async getDocument(id: string): Promise<MembershipDocument> {
    const membership = await this.membershipModel
      .findOne(notDeleted({ _id: id }))
      .exec();

    if (!membership) {
      throw new NotFoundException(`Membership ${id} not found`);
    }

    return membership;
  }

  private async ensureNameAvailable(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.membershipModel
      .findOne(notDeleted({ name }))
      .exec();

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Membership "${name}" already exists`);
    }
  }

  private async ensureTypeAvailable(
    type: MembershipType,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.findByType(type);

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`A "${type}" membership already exists`);
    }
  }

  private async ensureDefaultMemberships(): Promise<void> {
    for (const seed of DEFAULT_MEMBERSHIPS) {
      const existing = await this.findByType(seed.type);

      if (!existing) {
        await this.membershipModel.create(seed);
        this.logger.log(`Seeded membership "${seed.name}" (${seed.type})`);
        continue;
      }

      await this.membershipModel
        .updateOne(
          { _id: existing._id },
          {
            $set: {
              monthlyPrice: seed.monthlyPrice,
              yearlyPrice: seed.yearlyPrice,
            },
            $unset: { price: 1 },
          },
        )
        .exec();
    }
  }
}
