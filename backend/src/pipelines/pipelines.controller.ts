import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PipelinesService } from './pipelines.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../common/types/jwt-user.type';
import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreatePipelineDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

class UpdatePipelineDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class StageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiProperty() @IsInt() @Min(0) @Type(() => Number) order: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) @Type(() => Number) probability?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isWon?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isLost?: boolean;
}

class UpdateStagesDto {
  @ApiProperty({ type: [StageDto] }) @IsArray() stages: StageDto[];
}

@ApiTags('pipelines')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  @ApiOperation({ summary: 'List all pipelines for the agency' })
  async findAll(@CurrentUser() user: JwtUser) {
    return this.pipelinesService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single pipeline with stages' })
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.pipelinesService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new pipeline' })
  async create(@Body() dto: CreatePipelineDto, @CurrentUser() user: JwtUser) {
    return this.pipelinesService.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update pipeline name/description/status' })
  async update(@Param('id') id: string, @Body() dto: UpdatePipelineDto, @CurrentUser() user: JwtUser) {
    return this.pipelinesService.update(id, dto, user);
  }

  @Patch(':id/stages')
  @ApiOperation({ summary: 'Create, update, reorder, and delete pipeline stages' })
  async updateStages(@Param('id') id: string, @Body() dto: UpdateStagesDto, @CurrentUser() user: JwtUser) {
    return this.pipelinesService.updateStages(id, dto.stages, user);
  }
}
