import { Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StalledDetectionService } from './stalled-detection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../common/types/jwt-user.type';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

@ApiTags('deals')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class StalledDetectionController {
  constructor(private readonly stalledService: StalledDetectionService) {}

  @Post('stalled/detect')
  @ApiOperation({ summary: 'Run stalled deal detection for the agency' })
  @ApiQuery({ name: 'thresholdDays', required: false, type: Number })
  async detect(@Query('thresholdDays') thresholdDays: string, @CurrentUser() user: JwtUser) {
    const days = thresholdDays ? parseInt(thresholdDays, 10) : 7;
    return this.stalledService.detectStalledDeals(user.agencyId, days);
  }

  @Get('stalled')
  @ApiOperation({ summary: 'Get all currently stalled deals for the agency' })
  async getStalledDeals(@CurrentUser() user: JwtUser) {
    return this.stalledService.getStalledDeals(user.agencyId);
  }
}
