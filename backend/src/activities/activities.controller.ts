import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../common/types/jwt-user.type';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('deals')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('deals')
export class ActivitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':dealId/activities')
  @ApiOperation({ summary: 'Get activity log for a deal' })
  async getActivities(
    @Param('dealId') dealId: string,
    @Query('limit') limit: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.prisma.dealActivity.findMany({
      where: { dealId, agencyId: user.agencyId },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? Math.min(parseInt(limit, 10), 100) : 50,
    });
  }
}
