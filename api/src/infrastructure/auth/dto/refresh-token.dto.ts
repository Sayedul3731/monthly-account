import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'JWT refresh token issued at login or register' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
