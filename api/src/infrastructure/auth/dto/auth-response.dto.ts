import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../modules/users/user.schema';

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ type: User })
  user: User;
}
