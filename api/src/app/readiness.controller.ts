import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Connection, ConnectionStates } from 'mongoose';
import { Public } from '../infrastructure/auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class ReadinessController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Database readiness, including payment transaction support',
  })
  async ready() {
    try {
      if (
        this.connection.readyState !== ConnectionStates.connected ||
        !this.connection.db
      )
        throw new Error('Disconnected');
      const topology = await this.connection.db
        .admin()
        .command({ hello: 1, maxTimeMS: 3000 }, { timeoutMS: 3000 });
      if (!topology.setName && topology.msg !== 'isdbgrid')
        throw new Error('Transactions unsupported');
      return {
        status: 'ready',
        database: 'connected',
        transactions: 'supported',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        message: 'Database unavailable or MongoDB transactions unsupported',
      });
    }
  }
}
