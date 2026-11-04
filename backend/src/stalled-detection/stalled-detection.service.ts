import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_STALL_THRESHOLD_DAYS = 7;

@Injectable()
export class StalledDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run stalled detection for all active deals of an agency.
   * Threshold defaults to 7 days of inactivity. Configurable via parameter.
   */
  async detectStalledDeals(agencyId: string, thresholdDays = DEFAULT_STALL_THRESHOLD_DAYS) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - thresholdDays);

    // Find active deals with last activity before the threshold
    const activeDeals = await this.prisma.deal.findMany({
      where: { agencyId, state: 'ACTIVE' },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 1 },
        intelligence: true,
      },
    });

    const stalledDeals: string[] = [];
    const unstalleddDeals: string[] = [];

    for (const deal of activeDeals) {
      const lastActivity = deal.activities[0];
      const lastActivityDate = lastActivity?.createdAt ?? deal.createdAt;
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24),
      );

      const isStalled = daysSinceActivity >= thresholdDays;

      if (isStalled && !deal.intelligence?.isStalled) {
        // Mark as newly stalled
        await this.prisma.dealIntelligence.upsert({
          where: { dealId: deal.id },
          update: {
            isStalled: true,
            stalledAt: new Date(),
            inactiveDays: daysSinceActivity,
            lastActivityAt: lastActivityDate,
            stalledReason: `No meaningful activity for ${daysSinceActivity} days (threshold: ${thresholdDays} days)`,
          },
          create: {
            dealId: deal.id,
            agencyId,
            isStalled: true,
            stalledAt: new Date(),
            inactiveDays: daysSinceActivity,
            lastActivityAt: lastActivityDate,
            stalledReason: `No meaningful activity for ${daysSinceActivity} days`,
          },
        });
        stalledDeals.push(deal.id);
      } else if (!isStalled && deal.intelligence?.isStalled) {
        // Un-stall deals that have had recent activity
        await this.prisma.dealIntelligence.update({
          where: { dealId: deal.id },
          data: { isStalled: false, stalledAt: null, inactiveDays: daysSinceActivity, lastActivityAt: lastActivityDate },
        });
        unstalleddDeals.push(deal.id);
      } else if (deal.intelligence) {
        // Update inactive days count
        await this.prisma.dealIntelligence.update({
          where: { dealId: deal.id },
          data: { inactiveDays: daysSinceActivity, lastActivityAt: lastActivityDate },
        });
      }
    }

    return {
      checked: activeDeals.length,
      newlyStalled: stalledDeals.length,
      unstalled: unstalleddDeals.length,
      threshold: thresholdDays,
    };
  }

  /**
   * Get all currently stalled deals for an agency.
   */
  async getStalledDeals(agencyId: string) {
    return this.prisma.deal.findMany({
      where: {
        agencyId,
        state: 'ACTIVE',
        intelligence: { isStalled: true },
      },
      include: {
        client: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        stage: { select: { id: true, name: true } },
        intelligence: true,
      },
      orderBy: { updatedAt: 'asc' },
    });
  }
}
