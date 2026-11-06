import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProbabilityService } from '../probability/probability.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MoveDealStageDto } from './dto/move-deal-stage.dto';
import { MarkDealLostDto } from './dto/mark-deal-lost.dto';
import { DealQueryDto } from './dto/deal-query.dto';
import { JwtUser } from '../common/types/jwt-user.type';
import { DealState, ActivityType, FollowUpStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

const DEAL_INCLUDE: Prisma.DealInclude = {
  client: { select: { id: true, name: true, company: true } },
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  pipeline: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true, slug: true, order: true, isWon: true, isLost: true, color: true, probability: true } },
  intelligence: true,
  followUps: {
    where: { status: { in: [FollowUpStatus.UPCOMING, FollowUpStatus.OVERDUE] } },
    orderBy: { scheduledAt: 'asc' as const },
    take: 1,
  },
};

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly probabilityService: ProbabilityService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async create(dto: CreateDealDto, user: JwtUser) {
    const isAdmin = user.roles.includes('ADMIN');
    const effectiveOwnerId = isAdmin ? (dto.ownerId || user.sub) : user.sub;

    if (!isAdmin && dto.ownerId && dto.ownerId !== user.sub) {
      throw new ForbiddenException({
        message: 'Sales users can only create deals assigned to themselves.',
        code: 'FORBIDDEN',
      });
    }

    // Validate pipeline, stage, client, and owner all belong to the same agency
    await this.validatePipelineStage(dto.pipelineId, dto.stageId, user.agencyId);
    await this.validateClient(dto.clientId, user.agencyId);
    await this.validateOwner(effectiveOwnerId, user.agencyId);

    const deal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.deal.create({
        data: {
          agencyId: user.agencyId,
          clientId: dto.clientId,
          title: dto.title,
          description: dto.description,
          serviceCategory: dto.serviceCategory,
          expectedValue: dto.expectedValue,
          currency: dto.currency,
          ownerId: effectiveOwnerId,
          pipelineId: dto.pipelineId,
          stageId: dto.stageId,
          expectedCloseDate: new Date(dto.expectedCloseDate),
          source: dto.source,
          notes: dto.notes,
          tags: dto.tags || [],
          manualProbability: dto.manualProbability,
        },
        include: DEAL_INCLUDE,
      });

      // Record stage history
      await tx.dealStageHistory.create({
        data: {
          dealId: created.id,
          agencyId: user.agencyId,
          fromStageId: null,
          toStageId: dto.stageId,
          movedById: user.sub,
          note: 'Deal created',
        },
      });

      // Record activity
      await tx.dealActivity.create({
        data: {
          dealId: created.id,
          agencyId: user.agencyId,
          activityType: ActivityType.DEAL_CREATED,
          description: `Deal "${created.title}" was created`,
          performedById: user.sub,
        },
      });

      // Create initial intelligence record using probability service
      const probResult = await this.probabilityService.calculateForDeal(created.id, user.agencyId);
      await tx.dealIntelligence.create({
        data: {
          dealId: created.id,
          agencyId: user.agencyId,
          calculatedProbability: probResult.probability,
          probabilitySignals: probResult.signals as any,
          calculationVersion: probResult.version,
          lastActivityAt: new Date(),
        },
      });

      return created;
    });

    return deal;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────────────────────────────────

  async findAll(query: DealQueryDto, user: JwtUser) {
    const {
      search,
      pipelineId,
      stageId,
      clientId,
      ownerId,
      state,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const isAdmin = user.roles.includes('ADMIN');

    const where: Prisma.DealWhereInput = {
      agencyId: user.agencyId,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(pipelineId && { pipelineId }),
      ...(stageId && { stageId }),
      ...(clientId && { clientId }),
      ...(isAdmin ? (ownerId ? { ownerId } : {}) : { ownerId: user.sub }),
      ...(state && { state: state as DealState }),
    };

    const validSortFields = ['createdAt', 'updatedAt', 'expectedCloseDate', 'expectedValue', 'title'];
    const orderBy = validSortFields.includes(sortBy)
      ? { [sortBy]: sortOrder }
      : { createdAt: 'desc' as const };

    const skip = (page - 1) * limit;

    const [total, deals] = await this.prisma.$transaction([
      this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({
        where,
        include: DEAL_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return {
      deals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET ONE
  // ─────────────────────────────────────────────────────────────────────────

  async findOne(id: string, user: JwtUser) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, agencyId: user.agencyId },
      include: {
        ...DEAL_INCLUDE,
        stageHistory: {
          include: {
            fromStage: { select: { id: true, name: true } },
            toStage: { select: { id: true, name: true } },
            movedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            performedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        followUps: {
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });

    if (!deal) {
      throw new NotFoundException({ message: 'Deal not found', code: 'DEAL_NOT_FOUND' });
    }

    if (!user.roles.includes('ADMIN') && deal.ownerId !== user.sub) {
      throw new ForbiddenException({
        message: 'You do not have permission to view this deal.',
        code: 'FORBIDDEN',
      });
    }

    return deal;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateDealDto, user: JwtUser) {
    const deal = await this.requireDeal(id, user.agencyId);

    if (!user.roles.includes('ADMIN')) {
      if (deal.ownerId !== user.sub) {
        throw new ForbiddenException({
          message: 'You can only edit deals assigned to you.',
          code: 'FORBIDDEN',
        });
      }
      if (dto.ownerId && dto.ownerId !== user.sub) {
        throw new ForbiddenException({
          message: 'Sales users cannot reassign deal ownership.',
          code: 'FORBIDDEN',
        });
      }
    }

    if (deal.state !== DealState.ACTIVE) {
      throw new BadRequestException({
        message: 'Only active deals can be edited. Reopen the deal first.',
        code: 'DEAL_NOT_ACTIVE',
      });
    }

    if (dto.pipelineId || dto.stageId) {
      const pipelineId = dto.pipelineId || deal.pipelineId;
      const stageId = dto.stageId || deal.stageId;
      await this.validatePipelineStage(pipelineId, stageId, user.agencyId);
    }
    if (dto.clientId) await this.validateClient(dto.clientId, user.agencyId);
    if (dto.ownerId) await this.validateOwner(dto.ownerId, user.agencyId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.deal.update({
        where: { id },
        data: {
          ...(dto.title && { title: dto.title }),
          ...(dto.clientId && { clientId: dto.clientId }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.serviceCategory && { serviceCategory: dto.serviceCategory }),
          ...(dto.expectedValue !== undefined && { expectedValue: dto.expectedValue }),
          ...(dto.currency && { currency: dto.currency }),
          ...(dto.ownerId && { ownerId: dto.ownerId }),
          ...(dto.pipelineId && { pipelineId: dto.pipelineId }),
          ...(dto.stageId && { stageId: dto.stageId }),
          ...(dto.expectedCloseDate && { expectedCloseDate: new Date(dto.expectedCloseDate) }),
          ...(dto.source !== undefined && { source: dto.source }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.tags && { tags: dto.tags }),
          ...(dto.manualProbability !== undefined && { manualProbability: dto.manualProbability }),
        },
        include: DEAL_INCLUDE,
      });

      await tx.dealActivity.create({
        data: {
          dealId: id,
          agencyId: user.agencyId,
          activityType: ActivityType.NOTE_ADDED,
          description: `Deal "${result.title}" was updated`,
          performedById: user.sub,
        },
      });

      // Recalculate probability after update
      const probResult = await this.probabilityService.calculateForDeal(id, user.agencyId);
      await tx.dealIntelligence.upsert({
        where: { dealId: id },
        update: {
          calculatedProbability: probResult.probability,
          probabilitySignals: probResult.signals as any,
          calculationVersion: probResult.version,
          lastActivityAt: new Date(),
        },
        create: {
          dealId: id,
          agencyId: user.agencyId,
          calculatedProbability: probResult.probability,
          probabilitySignals: probResult.signals as any,
          calculationVersion: probResult.version,
          lastActivityAt: new Date(),
        },
      });

      return result;
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOVE STAGE
  // ─────────────────────────────────────────────────────────────────────────

  async moveStage(id: string, dto: MoveDealStageDto, user: JwtUser) {
    const deal = await this.requireDeal(id, user.agencyId);

    if (!user.roles.includes('ADMIN') && deal.ownerId !== user.sub) {
      throw new ForbiddenException({
        message: 'You can only move deals assigned to you.',
        code: 'FORBIDDEN',
      });
    }

    if (deal.state !== DealState.ACTIVE) {
      throw new BadRequestException({
        message: 'Closed deals cannot be moved between stages. Reopen the deal first.',
        code: 'DEAL_NOT_ACTIVE',
      });
    }

    if (deal.stageId === dto.stageId) {
      throw new BadRequestException({
        message: 'Deal is already in this stage',
        code: 'SAME_STAGE',
      });
    }

    // Validate target stage belongs to same pipeline and agency
    const targetStage = await this.prisma.pipelineStage.findFirst({
      where: { id: dto.stageId, pipelineId: deal.pipelineId, agencyId: user.agencyId },
    });

    if (!targetStage) {
      throw new BadRequestException({
        message: 'Target stage not found in this pipeline',
        code: 'INVALID_STAGE',
      });
    }

    // Won/Lost stages must use the dedicated endpoints
    if (targetStage.isWon) {
      throw new BadRequestException({
        message: 'Use the /won endpoint to mark a deal as Won',
        code: 'USE_WON_ENDPOINT',
      });
    }
    if (targetStage.isLost) {
      throw new BadRequestException({
        message: 'Use the /lost endpoint to mark a deal as Lost',
        code: 'USE_LOST_ENDPOINT',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.deal.update({
        where: { id },
        data: { stageId: dto.stageId },
        include: DEAL_INCLUDE,
      });

      await tx.dealStageHistory.create({
        data: {
          dealId: id,
          agencyId: user.agencyId,
          fromStageId: deal.stageId,
          toStageId: dto.stageId,
          movedById: user.sub,
          note: dto.note,
        },
      });

      await tx.dealActivity.create({
        data: {
          dealId: id,
          agencyId: user.agencyId,
          activityType: ActivityType.STAGE_CHANGE,
          description: `Deal moved to "${targetStage.name}"`,
          metadata: { fromStageId: deal.stageId, toStageId: dto.stageId },
          performedById: user.sub,
        },
      });

      // Recalculate probability using service
      const probResult = await this.probabilityService.calculateForDeal(id, user.agencyId);
      await tx.dealIntelligence.upsert({
        where: { dealId: id },
        update: {
          calculatedProbability: probResult.probability,
          probabilitySignals: probResult.signals as any,
          calculationVersion: probResult.version,
          isStalled: false,
          stalledAt: null,
          lastActivityAt: new Date(),
          inactiveDays: 0,
        },
        create: {
          dealId: id,
          agencyId: user.agencyId,
          calculatedProbability: probResult.probability,
          probabilitySignals: probResult.signals as any,
          calculationVersion: probResult.version,
          lastActivityAt: new Date(),
        },
      });

      return result;
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WON
  // ─────────────────────────────────────────────────────────────────────────

  async markWon(id: string, user: JwtUser) {
    const deal = await this.requireDeal(id, user.agencyId);

    if (!user.roles.includes('ADMIN') && deal.ownerId !== user.sub) {
      throw new ForbiddenException({
        message: 'You can only close deals assigned to you.',
        code: 'FORBIDDEN',
      });
    }

    if (deal.state !== DealState.ACTIVE) {
      throw new ConflictException({
        message: `Deal is already ${deal.state.toLowerCase()}`,
        code: 'DEAL_ALREADY_CLOSED',
      });
    }

    // Find the Won stage in this pipeline
    const wonStage = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId: deal.pipelineId, isWon: true },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.deal.update({
        where: { id },
        data: {
          state: DealState.WON,
          wonAt: new Date(),
          ...(wonStage && { stageId: wonStage.id }),
        },
        include: DEAL_INCLUDE,
      });

      if (wonStage && deal.stageId !== wonStage.id) {
        await tx.dealStageHistory.create({
          data: {
            dealId: id,
            agencyId: user.agencyId,
            fromStageId: deal.stageId,
            toStageId: wonStage.id,
            movedById: user.sub,
            note: 'Deal marked as Won',
          },
        });
      }

      await tx.dealActivity.create({
        data: {
          dealId: id,
          agencyId: user.agencyId,
          activityType: ActivityType.DEAL_WON,
          description: `Deal "${result.title}" was marked as Won`,
          performedById: user.sub,
        },
      });

      // Recalculate probability via service (should be 100 but ensure consistency)
      const probResult = await this.probabilityService.calculateForDeal(id, user.agencyId);
      await tx.dealIntelligence.upsert({
        where: { dealId: id },
        update: {
          calculatedProbability: probResult.probability,
          probabilitySignals: probResult.signals as any,
          calculationVersion: probResult.version,
          isStalled: false,
        },
        create: {
          dealId: id,
          agencyId: user.agencyId,
          calculatedProbability: probResult.probability,
          probabilitySignals: probResult.signals as any,
          calculationVersion: probResult.version,
        },
      });

      return result;
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOST
  // ─────────────────────────────────────────────────────────────────────────

  async markLost(id: string, dto: MarkDealLostDto, user: JwtUser) {
    const deal = await this.requireDeal(id, user.agencyId);

    if (!user.roles.includes('ADMIN') && deal.ownerId !== user.sub) {
      throw new ForbiddenException({
        message: 'You can only close deals assigned to you.',
        code: 'FORBIDDEN',
      });
    }

    if (deal.state !== DealState.ACTIVE) {
      throw new ConflictException({
        message: `Deal is already ${deal.state.toLowerCase()}`,
        code: 'DEAL_ALREADY_CLOSED',
      });
    }

    // Find the Lost stage in this pipeline
    const lostStage = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId: deal.pipelineId, isLost: true },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.deal.update({
        where: { id },
        data: {
          state: DealState.LOST,
          lostAt: new Date(),
          lostReason: dto.lostReason,
          lostNote: dto.lostNote,
          ...(lostStage && { stageId: lostStage.id }),
        },
        include: DEAL_INCLUDE,
      });

      if (lostStage && deal.stageId !== lostStage.id) {
        await tx.dealStageHistory.create({
          data: {
            dealId: id,
            agencyId: user.agencyId,
            fromStageId: deal.stageId,
            toStageId: lostStage.id,
            movedById: user.sub,
            note: `Deal marked as Lost: ${dto.lostReason}`,
          },
        });
      }

      await tx.dealActivity.create({
        data: {
          dealId: id,
          agencyId: user.agencyId,
          activityType: ActivityType.DEAL_LOST,
          description: `Deal "${result.title}" was marked as Lost. Reason: ${dto.lostReason}`,
          metadata: { lostReason: dto.lostReason },
          performedById: user.sub,
        },
      });

      // Recalculate probability via service (should be 0 but ensure consistency)
      const probResult = await this.probabilityService.calculateForDeal(id, user.agencyId);
      await tx.dealIntelligence.upsert({
        where: { dealId: id },
        update: {
          calculatedProbability: probResult.probability,
          probabilitySignals: probResult.signals as any,
          calculationVersion: probResult.version,
          isStalled: false,
        },
        create: {
          dealId: id,
          agencyId: user.agencyId,
          calculatedProbability: probResult.probability,
          probabilitySignals: probResult.signals as any,
          calculationVersion: probResult.version,
        },
      });

      return result;
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ARCHIVE
  // ─────────────────────────────────────────────────────────────────────────

  async archive(id: string, user: JwtUser) {
    if (!user.roles.includes('ADMIN')) {
      throw new ForbiddenException({
        message: 'Only Super Admin can archive deals.',
        code: 'FORBIDDEN',
      });
    }

    const deal = await this.requireDeal(id, user.agencyId);

    if (deal.state === DealState.ARCHIVED) {
      throw new ConflictException({ message: 'Deal is already archived', code: 'ALREADY_ARCHIVED' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.deal.update({
        where: { id },
        data: { state: DealState.ARCHIVED, archivedAt: new Date() },
        include: DEAL_INCLUDE,
      });

      await tx.dealActivity.create({
        data: {
          dealId: id,
          agencyId: user.agencyId,
          activityType: ActivityType.DEAL_ARCHIVED,
          description: `Deal "${result.title}" was archived`,
          performedById: user.sub,
        },
      });

      return result;
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private async requireDeal(id: string, agencyId: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, agencyId } });
    if (!deal) {
      throw new NotFoundException({ message: 'Deal not found', code: 'DEAL_NOT_FOUND' });
    }
    return deal;
  }

  private async validatePipelineStage(pipelineId: string, stageId: string, agencyId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, agencyId },
    });
    if (!stage) {
      throw new BadRequestException({
        message: 'Stage does not belong to the specified pipeline or agency',
        code: 'INVALID_PIPELINE_STAGE',
      });
    }
  }

  private async validateClient(clientId: string, agencyId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, agencyId } });
    if (!client) {
      throw new BadRequestException({
        message: 'Client not found in this agency',
        code: 'INVALID_CLIENT',
      });
    }
  }

  private async validateOwner(ownerId: string, agencyId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: ownerId, agencyId } });
    if (!user) {
      throw new BadRequestException({
        message: 'Owner not found in this agency',
        code: 'INVALID_OWNER',
      });
    }
  }
}
