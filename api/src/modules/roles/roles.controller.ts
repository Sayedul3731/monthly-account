import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../../shared/pipes/parse-object-id.pipe';
import { AppRole, DefaultRole } from './app-role.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List app roles' })
  @ApiOkResponse({ type: AppRole, isArray: true })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: AppRole })
  @ApiNotFoundResponse({ description: 'Role not found' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'Create a role (admin only)' })
  @ApiOkResponse({ type: AppRole })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'Update a role (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: AppRole })
  @ApiNotFoundResponse({ description: 'Role not found' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(DefaultRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiNoContentResponse({ description: 'Role deleted' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.rolesService.remove(id);
  }
}
