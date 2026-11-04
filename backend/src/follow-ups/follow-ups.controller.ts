import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FollowUpsService, CreateFollowUpDto, UpdateFollowUpDto } from './follow-ups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../common/types/jwt-user.type';

@ApiTags('follow-ups')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller()
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Post('deals/:dealId/follow-ups')
  @ApiOperation({ summary: 'Create a follow-up for a deal' })
  async create(@Param('dealId') dealId: string, @Body() dto: CreateFollowUpDto, @CurrentUser() user: JwtUser) {
    return this.followUpsService.createForDeal(dealId, dto, user);
  }

  @Get('deals/:dealId/follow-ups')
  @ApiOperation({ summary: 'Get all follow-ups for a deal' })
  async getForDeal(@Param('dealId') dealId: string, @CurrentUser() user: JwtUser) {
    return this.followUpsService.getForDeal(dealId, user);
  }

  @Patch('follow-ups/:id')
  @ApiOperation({ summary: 'Update, complete, or reschedule a follow-up' })
  async update(@Param('id') id: string, @Body() dto: UpdateFollowUpDto, @CurrentUser() user: JwtUser) {
    return this.followUpsService.update(id, dto, user);
  }

  @Get('follow-ups')
  @ApiOperation({ summary: 'Get all follow-ups for the agency (with optional status filter)' })
  async getAgencyFollowUps(@Query('status') status: string, @CurrentUser() user: JwtUser) {
    return this.followUpsService.getAgencyFollowUps(user, status);
  }
}
