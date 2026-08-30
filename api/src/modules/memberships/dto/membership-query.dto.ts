import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { MembershipType } from '../membership-type.enum';

export class MembershipQueryDto {
  @ApiPropertyOptional({ enum: MembershipType })
  @IsOptional()
  @IsEnum(MembershipType)
  type?: MembershipType;
}
