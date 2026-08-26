import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { notDeleted } from '../common/schemas/schema.helpers';
import { DefaultRole } from '../roles/app-role.schema';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './user.schema';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly rolesService: RolesService,
  ) {}

  findAll(): Promise<User[]> {
    return this.userModel
      .find(notDeleted())
      .populate('role')
      .sort({ name: 1 })
      .exec();
  }

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne(notDeleted({ _id: id }))
      .populate('role')
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
      .populate('role')
      .exec();
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    await this.ensureEmailAvailable(dto.email);
    const roleId = dto.roleId ?? (await this.getDefaultRoleId());

    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email,
      password: await bcrypt.hash(dto.password, SALT_ROUNDS),
      roleId: new Types.ObjectId(roleId),
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
    }
    const roleChanged =
      dto.roleId !== undefined && dto.roleId !== user.roleId.toString();
    if (dto.roleId !== undefined) {
      user.roleId = new Types.ObjectId(dto.roleId);
    }

    await user.save();

    return roleChanged ? this.findOne(user.id) : user.populate('role');
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

  private async getDefaultRoleId(): Promise<string> {
    const role = await this.rolesService.findByName(DefaultRole.USER);

    if (!role) {
      throw new NotFoundException(
        `Default role "${DefaultRole.USER}" is not seeded`,
      );
    }

    return role.id;
  }
}
