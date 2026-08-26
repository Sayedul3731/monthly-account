import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/user.schema';

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ type: User })
  user: User;
}
