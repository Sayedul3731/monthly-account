import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateOnboardingDto {
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 4,
    description: 'Furthest setup step reached',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(4)
  step?: number;

  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Month being set up; saved once when setup starts',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/)
  period?: string;

  @ApiPropertyOptional({ enum: ['completed', 'skipped'] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['completed', 'skipped'])
  status?: 'completed' | 'skipped';
}
