import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import {
  asPlainList,
  notDeleted,
} from '../../infrastructure/database/schema.helpers';
import { BillingInterval } from '../memberships/billing-interval.enum';
import { MembershipType } from '../memberships/membership-type.enum';
import { MembershipsService } from '../memberships/memberships.service';
import { DefaultRole } from '../roles/app-role.schema';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './user.schema';

const SALT_ROUNDS = 10;
const USER_POPULATE = ['role', 'membership'] as const;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly rolesService: RolesService,
    private readonly membershipsService: MembershipsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultMembershipsAssigned();
  }

  async findAll(): Promise<User[]> {
    const docs = await this.userModel
      .find(notDeleted())
      .populate([...USER_POPULATE])
      .sort({ name: 1 })
      .exec();

    return asPlainList<User>(docs);
  }

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne(notDeleted({ _id: id }))
      .populate([...USER_POPULATE])
      .exec();

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  /**
   * Looks up a user by email including the hashed password, for use during
   * authentication. Not exposed via the controller.
   */
  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne(notDeleted({ email }))
      .select('+password')
      .populate([...USER_POPULATE])
      .exec();
  }

  findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne(notDeleted({ googleId }))
      .select('+googleId')
      .populate([...USER_POPULATE])
      .exec();
  }

  /**
   * Looks up a user by id including the stored refresh-token hash.
   * Not exposed via the controller.
   */
  findByIdWithRefreshToken(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne(notDeleted({ _id: id }))
      .select('+refreshToken')
      .populate([...USER_POPULATE])
      .exec();
  }

  async setRefreshToken(id: string, hashedRefreshToken: string): Promise<void> {
    const result = await this.userModel
      .updateOne(notDeleted({ _id: id }), { refreshToken: hashedRefreshToken })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  async clearRefreshToken(id: string): Promise<void> {
    await this.userModel
      .updateOne(notDeleted({ _id: id }), { refreshToken: null })
      .exec();
  }

  async findOrCreateGoogleUser(input: {
    googleId: string;
    email: string;
    name: string;
  }): Promise<UserDocument> {
    const email = input.email.trim().toLowerCase();
    const byGoogleId = await this.findByGoogleId(input.googleId);
    if (byGoogleId) return byGoogleId;

    const existing = await this.findByEmail(email);
    if (existing) {
      existing.googleId = input.googleId;
      await existing.save();
      return existing.populate([...USER_POPULATE]);
    }

    const roleId = await this.getDefaultRoleId();
    const membershipId = await this.getDefaultMembershipId();
    const user = await this.userModel.create({
      name: input.name.trim().slice(0, 100) || email,
      email,
      googleId: input.googleId,
      roleId: new Types.ObjectId(roleId),
      membershipId: new Types.ObjectId(membershipId),
      billingInterval: null,
    });

    return this.findOne(user.id);
  }

  async createOAuthHandoff(userId: string): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    const result = await this.userModel
      .updateOne(notDeleted({ _id: userId }), {
        oauthHandoffHash: this.hashOAuthHandoff(code),
        oauthHandoffExpiresAt: new Date(Date.now() + 60_000),
      })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return code;
  }

  async consumeOAuthHandoff(code: string): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        {
          ...notDeleted(),
          oauthHandoffHash: this.hashOAuthHandoff(code),
          oauthHandoffExpiresAt: { $gt: new Date() },
        },
        {
          $set: { oauthHandoffHash: null, oauthHandoffExpiresAt: null },
        },
        { new: true },
      )
      .populate([...USER_POPULATE])
      .exec();
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    await this.ensureEmailAvailable(dto.email);
    const roleId = dto.roleId ?? (await this.getDefaultRoleId());
    const membershipId =
      dto.membershipId ?? (await this.getDefaultMembershipId());
    const membership = await this.membershipsService.findOne(membershipId);
    const billingInterval = this.resolveBillingInterval(
      membership.type,
      dto.billingInterval,
    );

    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email,
      password: await bcrypt.hash(dto.password, SALT_ROUNDS),
      roleId: new Types.ObjectId(roleId),
      membershipId: new Types.ObjectId(membershipId),
      billingInterval,
    });

    return this.findOne(user.id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.findOne(id);

    if (dto.email !== undefined && dto.email !== user.email) {
      await this.ensureEmailAvailable(dto.email);
      user.email = dto.email;
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.password !== undefined) {
      user.password = await bcrypt.hash(dto.password, SALT_ROUNDS);
      user.refreshToken = null;
    }
    const roleChanged =
      dto.roleId !== undefined && dto.roleId !== user.roleId.toString();
    if (dto.roleId !== undefined) {
      user.roleId = new Types.ObjectId(dto.roleId);
    }

    const membershipChanged =
      dto.membershipId !== undefined &&
      dto.membershipId !== user.membershipId?.toString();
    const intervalChanged =
      dto.billingInterval !== undefined &&
      dto.billingInterval !== user.billingInterval;

    if (dto.membershipId !== undefined || dto.billingInterval !== undefined) {
      const membership = await this.membershipsService.findOne(
        dto.membershipId ?? user.membershipId.toString(),
      );
      user.membershipId = new Types.ObjectId(
        dto.membershipId ?? user.membershipId.toString(),
      );
      user.billingInterval = this.resolveBillingInterval(
        membership.type,
        dto.billingInterval ?? user.billingInterval,
      );
    }

    await user.save();

    return roleChanged || membershipChanged || intervalChanged
      ? this.findOne(user.id)
      : user.populate([...USER_POPULATE]);
  }

  async remove(id: string): Promise<void> {
    const result = await this.userModel
      .updateOne(notDeleted({ _id: id }), { deletedAt: new Date() })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const existing = await this.userModel.findOne(notDeleted({ email })).exec();

    if (existing) {
      throw new ConflictException(`Email ${email} is already in use`);
    }
  }

  private hashOAuthHandoff(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private async getDefaultRoleId(): Promise<string> {
    const role = await this.rolesService.findByName(DefaultRole.USER);

    if (!role) {
      throw new NotFoundException(
        `Default role "${DefaultRole.USER}" is not seeded`,
      );
    }

    return role.id;
  }

  private resolveBillingInterval(
    membershipType: MembershipType,
    interval?: BillingInterval | null,
  ): BillingInterval | null {
    if (membershipType === MembershipType.FREE) {
      return null;
    }

    if (
      interval === BillingInterval.MONTHLY ||
      interval === BillingInterval.YEARLY
    ) {
      return interval;
    }

    throw new BadRequestException(
      'Paid membership requires monthly or yearly billing',
    );
  }

  private async getDefaultMembershipId(): Promise<string> {
    const membership = await this.membershipsService.findByType(
      MembershipType.FREE,
    );

    if (!membership) {
      throw new NotFoundException(
        `Default membership "${MembershipType.FREE}" is not seeded`,
      );
    }

    return membership.id;
  }

  private async ensureDefaultMembershipsAssigned(): Promise<void> {
    const membershipId = await this.getDefaultMembershipId();
    const result = await this.userModel
      .updateMany(
        {
          deletedAt: null,
          $or: [{ membershipId: { $exists: false } }, { membershipId: null }],
        },
        { $set: { membershipId: new Types.ObjectId(membershipId) } },
      )
      .exec();

    if (result.modifiedCount) {
      this.logger.log(
        `Assigned free membership to ${result.modifiedCount} existing user(s)`,
      );
    }
  }
}
