import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserDto {
  @ApiProperty({ description: 'Unique identifier of the user' })
  userId: string;

  @ApiProperty({ description: 'Email address of the user' })
  email: string;

  @ApiProperty({ description: 'Role assigned to the user' })
  role: string;
}
