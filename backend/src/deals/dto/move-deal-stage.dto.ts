import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoveDealStageDto {
  @ApiProperty({ example: 'stage-uuid' })
  @IsUUID()
  stageId: string;

  @ApiPropertyOptional({ example: 'Client approved the proposal' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
