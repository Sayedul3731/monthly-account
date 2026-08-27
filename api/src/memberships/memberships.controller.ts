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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { DefaultRole } from '../roles/app-role.schema';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipQueryDto } from './dto/membership-query.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { Membership } from './membership.schema';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@ApiBearerAuth()
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  @ApiOperation({ summary: 'List memberships, optionally filtered by type' })
  @ApiOkResponse({ type: Membership, isArray: true })
  findAll(@Query() query: MembershipQueryDto) {
    return this.membershipsService.findAll(query.type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a membership by ID' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: Membership })
  @ApiNotFoundResponse({ description: 'Membership not found' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.membershipsService.findOne(id);
  }

  @Post()
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'Create a membership (admin only)' })
  @ApiOkResponse({ type: Membership })
  @ApiConflictResponse({ description: 'Name or type already exists' })
  create(@Body() dto: CreateMembershipDto) {
    return this.membershipsService.create(dto);
  }

  @Patch(':id')
  @Roles(DefaultRole.ADMIN)
  @ApiOperation({ summary: 'Update a membership (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: Membership })
  @ApiNotFoundResponse({ description: 'Membership not found' })
  @ApiConflictResponse({ description: 'Name or type already exists' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.membershipsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(DefaultRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a membership (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiNoContentResponse({ description: 'Membership deleted' })
  @ApiNotFoundResponse({ description: 'Membership not found' })
  @ApiConflictResponse({
    description: 'Membership is assigned to users',
  })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.membershipsService.remove(id);
  }
}
