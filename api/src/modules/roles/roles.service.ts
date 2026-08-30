import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  asPlain,
  asPlainList,
  notDeleted,
} from '../../infrastructure/database/schema.helpers';
import { AppRole, AppRoleDocument, DefaultRole } from './app-role.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const DEFAULT_ROLE_DESCRIPTIONS: Record<DefaultRole, string> = {
  [DefaultRole.ADMIN]: 'Full access to manage users, roles and data',
  [DefaultRole.USER]: 'Standard application user',
};

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectModel(AppRole.name)
    private readonly roleModel: Model<AppRoleDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultRoles();
  }

  async findAll(): Promise<AppRole[]> {
    const docs = await this.roleModel.find(notDeleted()).sort({ name: 1 }).exec();
    return asPlainList<AppRole>(docs);
  }

  async findOne(id: string): Promise<AppRoleDocument> {
    const role = await this.roleModel.findOne(notDeleted({ _id: id })).exec();

    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    return role;
  }

  findByName(name: string): Promise<AppRoleDocument | null> {
    return this.roleModel.findOne(notDeleted({ name })).exec();
  }

  async create(dto: CreateRoleDto): Promise<AppRole> {
    await this.ensureNameAvailable(dto.name);

    const role = await this.roleModel.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return asPlain<AppRole>(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<AppRole> {
    const role = await this.findOne(id);

    if (dto.name !== undefined && dto.name !== role.name) {
      await this.ensureNameAvailable(dto.name);
      role.name = dto.name;
    }

    if (dto.description !== undefined) role.description = dto.description;

    return asPlain<AppRole>(await role.save());
  }

  async remove(id: string): Promise<void> {
    const result = await this.roleModel
      .updateOne(notDeleted({ _id: id }), { deletedAt: new Date() })
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`Role ${id} not found`);
    }
  }

  private async ensureNameAvailable(name: string): Promise<void> {
    const existing = await this.findByName(name);

    if (existing) {
      throw new ConflictException(`Role "${name}" already exists`);
    }
  }

  private async ensureDefaultRoles(): Promise<void> {
    for (const name of Object.values(DefaultRole)) {
      const existing = await this.findByName(name);

      if (!existing) {
        await this.roleModel.create({
          name,
          description: DEFAULT_ROLE_DESCRIPTIONS[name],
        });
        this.logger.log(`Seeded default role "${name}"`);
      }
    }
  }
}
