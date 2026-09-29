import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../modules/users/user.schema';

export class AuthResponseDto {
  @ApiProperty({
    description: 'CSRF token to include in unsafe authenticated requests',
  })
  csrfToken: string;

  @ApiProperty({ type: User })
  user: User;
}
