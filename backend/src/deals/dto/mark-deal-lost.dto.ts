import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MarkDealLostDto {
  @ApiProperty({ example: 'Budget constraints' })
  @IsString()
  @MaxLength(500)
  lostReason: string;

  @ApiPropertyOptional({ example: 'Client decided to postpone the project.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lostNote?: string;
}
