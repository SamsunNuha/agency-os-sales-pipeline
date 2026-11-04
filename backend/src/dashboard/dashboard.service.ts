import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../common/types/jwt-user.type';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(user: JwtUser) {
    const agencyId = user.agencyId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const nextThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalActive,
      totalWon,
      totalLost,
      recentWon,
      overdueFollowUps,
      stalledDeals,
      upcomingClosures,
      activeDealValues,
      wonDealValues,
      pipelineStats,
      stageDistribution,
      recentActivities,
      upcomingFollowUps,
    ] = await Promise.all([
      // Count active deals
      this.prisma.deal.count({ where: { agencyId, state: 'ACTIVE' } }),
      // Count won deals total
      this.prisma.deal.count({ where: { agencyId, state: 'WON' } }),
      // Count lost deals total
      this.prisma.deal.count({ where: { agencyId, state: 'LOST' } }),
      // Won deals in last 30 days
      this.prisma.deal.count({
        where: { agencyId, state: 'WON', wonAt: { gte: thirtyDaysAgo } },
      }),
      // Overdue follow-ups
      this.prisma.dealFollowUp.count({
        where: { agencyId, status: 'OVERDUE' },
      }),
      // Stalled deals
      this.prisma.deal.count({
        where: { agencyId, state: 'ACTIVE', intelligence: { isStalled: true } },
      }),
      // Upcoming expected closures (next 30 days)
      this.prisma.deal.count({
        where: {
          agencyId,
          state: 'ACTIVE',
          expectedCloseDate: { gte: now, lte: nextThirtyDays },
        },
      }),
      // Active deal values grouped by currency
      this.prisma.deal.groupBy({
        by: ['currency'],
        where: { agencyId, state: 'ACTIVE' },
        _sum: { expectedValue: true },
        _count: true,
      }),
      // Won deal values grouped by currency
      this.prisma.deal.groupBy({
        by: ['currency'],
        where: { agencyId, state: 'WON' },
        _sum: { expectedValue: true },
      }),
      // Pipeline performance
      this.prisma.salesPipeline.findMany({
        where: { agencyId },
        include: {
          _count: {
            select: {
              deals: true,
            },
          },
          stages: {
            include: {
              _count: { select: { deals: { where: { state: 'ACTIVE' } } } },
            },
            orderBy: { order: 'asc' },
          },
        },
      }),
      // Stage distribution (active deals per stage)
      this.prisma.pipelineStage.findMany({
        where: { agencyId },
        include: {
          _count: { select: { deals: { where: { state: 'ACTIVE' } } } },
        },
        orderBy: [{ pipelineId: 'asc' }, { order: 'asc' }],
      }),
      // Recent activities (last 20)
      this.prisma.dealActivity.findMany({
        where: { agencyId },
        include: {
          deal: { select: { id: true, title: true } },
          performedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Upcoming follow-ups (next 7 days)
      this.prisma.dealFollowUp.findMany({
        where: {
          agencyId,
          status: 'UPCOMING',
          scheduledAt: { gte: now },
        },
        include: {
          deal: { select: { id: true, title: true, client: { select: { name: true } } } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      }),
    ]);

    // Calculate conversion rate
    const totalClosed = totalWon + totalLost;
    const conversionRate = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;

    // Build weighted forecast (sum of value * probability per currency)
    const weightedForecastByCurrency: Record<string, number> = {};
    const activeDealDetails = await this.prisma.deal.findMany({
      where: { agencyId, state: 'ACTIVE' },
      select: { expectedValue: true, currency: true, manualProbability: true, intelligence: { select: { calculatedProbability: true } } },
    });

    for (const deal of activeDealDetails) {
      const prob = (deal.manualProbability ?? deal.intelligence?.calculatedProbability ?? 50) / 100;
      const value = Number(deal.expectedValue) * prob;
      weightedForecastByCurrency[deal.currency] = (weightedForecastByCurrency[deal.currency] || 0) + value;
    }

    // At-risk deals
    const atRiskDeals = await this.prisma.deal.findMany({
      where: {
        agencyId,
        state: 'ACTIVE',
        OR: [
          { intelligence: { isStalled: true } },
          { expectedCloseDate: { lt: now } },
        ],
      },
      include: {
        client: { select: { name: true } },
        stage: { select: { name: true } },
        intelligence: true,
      },
      take: 10,
    });

    return {
      summary: {
        totalActiveDeals: totalActive,
        totalWonDeals: totalWon,
        totalLostDeals: totalLost,
        recentWonDeals: recentWon,
        conversionRate,
        overdueFollowUps,
        stalledDeals,
        upcomingClosures,
      },
      pipelineValueByCurrency: activeDealValues.reduce((acc, v) => {
        acc[v.currency] = Number(v._sum.expectedValue || 0);
        return acc;
      }, {} as Record<string, number>),
      wonValueByCurrency: wonDealValues.reduce((acc, v) => {
        acc[v.currency] = Number(v._sum.expectedValue || 0);
        return acc;
      }, {} as Record<string, number>),
      weightedForecastByCurrency,
      pipelineStats,
      stageDistribution: stageDistribution.map((s) => ({
        stageId: s.id,
        stageName: s.name,
        pipelineId: s.pipelineId,
        activeDeals: s._count.deals,
        color: s.color,
      })),
      recentActivities,
      upcomingFollowUps,
      atRiskDeals,
    };
  }
}
