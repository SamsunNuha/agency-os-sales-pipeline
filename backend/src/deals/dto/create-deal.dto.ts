import {
  IsString,
  IsUUID,
  IsNumber,
  IsISO8601,
  IsOptional,
  IsArray,
  Min,
  Max,
  MaxLength,
  IsIn,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDealDto {
  @ApiProperty({ example: 'E-commerce Platform Rebuild' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'client-uuid' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ example: 'Full redesign and rebuild of the existing store.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ example: 'Web Development' })
  @IsString()
  @MaxLength(100)
  serviceCategory: string;

  @ApiProperty({ example: 25000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  expectedValue: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED'])
  currency: string;

  @ApiProperty({ example: 'user-uuid' })
  @IsUUID()
  ownerId: string;

  @ApiProperty({ example: 'pipeline-uuid' })
  @IsUUID()
  pipelineId: string;

  @ApiProperty({ example: 'stage-uuid' })
  @IsUUID()
  stageId: string;

  @ApiProperty({ example: '2025-03-31T00:00:00.000Z' })
  @IsISO8601()
  expectedCloseDate: string;

  @ApiPropertyOptional({ example: 'Referred by John Smith' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  source?: string;

  @ApiPropertyOptional({ example: 'Client prefers React frontend.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @ApiPropertyOptional({ example: ['priority', 'enterprise'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  manualProbability?: number;
}
