import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../common/types/jwt-user.type';
import { Deal, DealIntelligence, PipelineStage } from '@prisma/client';

export interface ProbabilityResult {
  probability: number;
  signals: ProbabilitySignals;
  version: string;
}

export interface ProbabilitySignals {
  stageBase: number;
  activityBonus: number;
  closeDatePenalty: number;
  followUpBonus: number;
  qualificationBonus: number;
  stalledPenalty: number;
  explanation: string[];
}

const VERSION = 'v1.0-rule-based';

@Injectable()
export class ProbabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate probability for a single deal using deterministic rule-based scoring.
   * This is NOT machine learning / AI. It is an explainable rule engine.
   */
  async calculateForDeal(dealId: string, agencyId: string): Promise<ProbabilityResult> {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, agencyId },
      include: {
        stage: true,
        followUps: { where: { status: 'UPCOMING' }, orderBy: { scheduledAt: 'asc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
        intelligence: true,
      },
    });

    if (!deal) return { probability: 0, signals: this.emptySignals(), version: VERSION };

    const result = this.computeProbability(deal as any);

    // Persist the result
    await this.prisma.dealIntelligence.upsert({
      where: { dealId },
      update: {
        calculatedProbability: result.probability,
        probabilitySignals: result.signals as any,
        calculationVersion: VERSION,
        recalculatedAt: new Date(),
      },
      create: {
        dealId,
        agencyId,
        calculatedProbability: result.probability,
        probabilitySignals: result.signals as any,
        calculationVersion: VERSION,
        lastActivityAt: deal.activities[0]?.createdAt ?? null,
      },
    });

    return result;
  }

  computeProbability(deal: Deal & {
    stage: PipelineStage;
    followUps: any[];
    activities: any[];
    intelligence: DealIntelligence | null;
  }): ProbabilityResult {
    const signals: ProbabilitySignals = {
      stageBase: 0,
      activityBonus: 0,
      closeDatePenalty: 0,
      followUpBonus: 0,
      qualificationBonus: 0,
      stalledPenalty: 0,
      explanation: [],
    };

    // 1. Stage base probability
    const stageBase = deal.stage?.probability ?? 50;
    signals.stageBase = stageBase;
    signals.explanation.push(`Stage "${deal.stage?.name}" base probability: ${stageBase}%`);

    // 2. Activity recency bonus (up to +10)
    const lastActivity = deal.activities[0];
    let activityBonus = 0;
    if (lastActivity) {
      const daysSinceActivity = this.daysDiff(lastActivity.createdAt, new Date());
      if (daysSinceActivity <= 1) activityBonus = 10;
      else if (daysSinceActivity <= 3) activityBonus = 7;
      else if (daysSinceActivity <= 7) activityBonus = 3;
      else if (daysSinceActivity <= 14) activityBonus = 0;
      else activityBonus = -5;
      signals.activityBonus = activityBonus;
      signals.explanation.push(`Activity recency (${daysSinceActivity} days ago): ${activityBonus > 0 ? '+' : ''}${activityBonus}%`);
    }

    // 3. Close date penalty (if overdue or very soon)
    let closeDatePenalty = 0;
    const daysToClose = this.daysDiff(new Date(), new Date(deal.expectedCloseDate));
    if (daysToClose < 0) {
      closeDatePenalty = Math.max(-20, daysToClose); // max -20 for overdue
      signals.explanation.push(`Close date overdue by ${Math.abs(daysToClose)} days: ${closeDatePenalty}%`);
    } else if (daysToClose <= 7) {
      signals.explanation.push(`Close date within ${daysToClose} days: no penalty`);
    }
    signals.closeDatePenalty = closeDatePenalty;

    // 4. Follow-up bonus (+5 if upcoming follow-up exists)
    let followUpBonus = 0;
    if (deal.followUps.length > 0) {
      followUpBonus = 5;
      signals.explanation.push(`Active follow-up scheduled: +${followUpBonus}%`);
    }
    signals.followUpBonus = followUpBonus;

    // 5. Qualification bonus (service category and notes filled in)
    let qualificationBonus = 0;
    if (deal.description && deal.description.length > 50) qualificationBonus += 3;
    if (deal.notes && deal.notes.length > 20) qualificationBonus += 2;
    if (qualificationBonus > 0) {
      signals.explanation.push(`Qualification info present: +${qualificationBonus}%`);
    }
    signals.qualificationBonus = qualificationBonus;

    // 6. Stalled penalty
    let stalledPenalty = 0;
    if (deal.intelligence?.isStalled) {
      stalledPenalty = -15;
      signals.explanation.push(`Deal is stalled (${deal.intelligence.inactiveDays} inactive days): ${stalledPenalty}%`);
    }
    signals.stalledPenalty = stalledPenalty;

    // Final calculation
    const raw = stageBase + activityBonus + closeDatePenalty + followUpBonus + qualificationBonus + stalledPenalty;
    const probability = Math.min(100, Math.max(0, Math.round(raw)));

    return { probability, signals, version: VERSION };
  }

  private daysDiff(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  private emptySignals(): ProbabilitySignals {
    return {
      stageBase: 0,
      activityBonus: 0,
      closeDatePenalty: 0,
      followUpBonus: 0,
      qualificationBonus: 0,
      stalledPenalty: 0,
      explanation: [],
    };
  }
}
