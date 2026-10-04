import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Plaintext password. The API bcrypt-hashes this value before storage. Changing the password revokes active refresh tokens.',
    example: 'password123',
    minLength: 8,
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password?: string;

  @ApiPropertyOptional({
    description: 'Required when changing the password.',
    minLength: 8,
    maxLength: 64,
  })
  @ValidateIf((dto: UpdateProfileDto) => dto.password !== undefined)
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  currentPassword?: string;
}
