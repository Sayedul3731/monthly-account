import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { DefaultRole } from '../roles/app-role.schema';
import { AuditEvent } from './audit-event.schema';
import { AuditService } from './audit.service';

@ApiTags('audit-events')
@ApiBearerAuth()
@Roles(DefaultRole.ADMIN)
@Controller('audit-events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List the latest privileged write audit events' })
  @ApiOkResponse({ type: AuditEvent, isArray: true })
  findRecent(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.auditService.findRecent(Number.isFinite(parsed) ? parsed : 100);
  }
}
