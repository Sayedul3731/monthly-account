import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Plaintext password.',
    example: 'password123',
    minLength: 8,
    maxLength: 64,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}
