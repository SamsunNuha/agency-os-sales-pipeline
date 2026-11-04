import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProbabilityService } from './probability.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../common/types/jwt-user.type';

@ApiTags('probability')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('deals')
export class ProbabilityController {
  constructor(private readonly probabilityService: ProbabilityService) {}

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Calculate/recalculate deal probability score with explanation signals' })
  async analyze(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.probabilityService.calculateForDeal(id, user.agencyId);
  }
}
