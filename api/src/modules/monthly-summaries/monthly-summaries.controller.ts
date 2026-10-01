import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../../infrastructure/auth/decorators/public.decorator';
import { MonthlySummariesService } from './monthly-summaries.service';

@ApiTags('internal')
@Controller('internal/monthly-summaries')
export class MonthlySummariesController {
  constructor(
    private readonly monthlySummariesService: MonthlySummariesService,
  ) {}

  /** Invoked daily by Vercel Cron at 00:15 Asia/Dhaka. */
  @Get('run')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async run(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET;
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!secret || !token || !this.matchesSecret(token, secret)) {
      throw new UnauthorizedException('Invalid cron authorization');
    }
    return this.monthlySummariesService.publishPreviousMonth();
  }

  private matchesSecret(token: string, secret: string): boolean {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(secret);
    return (
      tokenBuffer.length === secretBuffer.length &&
      timingSafeEqual(tokenBuffer, secretBuffer)
    );
  }
}
