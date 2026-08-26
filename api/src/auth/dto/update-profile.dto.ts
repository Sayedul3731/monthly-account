import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'jane@example.com', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description:
      'SHA-256 hex digest of the plaintext password (client-side). The API bcrypt-hashes this value before storage. Changing the password revokes active refresh tokens.',
    example: 'a3f5b8c1d2e4f60718293a4b5c6d7e8f90123456789abcdef0123456789abcde',
    minLength: 64,
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  password?: string;
}
