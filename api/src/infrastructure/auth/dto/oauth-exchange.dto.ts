import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class OAuthExchangeDto {
  @ApiProperty({ description: 'Single-use OAuth handoff code' })
  @IsString()
  @Length(32, 255)
  code: string;
}
