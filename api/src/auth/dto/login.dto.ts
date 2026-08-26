import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description:
      'SHA-256 hex digest of the plaintext password (client-side). Compared against the bcrypt-hashed digest stored on the user.',
    example: 'a3f5b8c1d2e4f60718293a4b5c6d7e8f90123456789abcdef0123456789abcde',
    minLength: 64,
    maxLength: 64,
  })
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  password: string;
}
