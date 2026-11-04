import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HandoffService } from './handoff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../common/types/jwt-user.type';

@ApiTags('handoff')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('deals')
export class HandoffController {
  constructor(private readonly handoffService: HandoffService) {}

  @Post(':id/project-handoff')
  @ApiOperation({ summary: 'Initiate a protected project handoff for a Won deal' })
  @ApiResponse({ status: 201, description: 'Handoff payload returned and recorded' })
  @ApiResponse({ status: 400, description: 'Deal is not Won' })
  @ApiResponse({ status: 409, description: 'Deal has already been handed off' })
  async initiateHandoff(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.handoffService.initiateHandoff(id, user);
  }
}
