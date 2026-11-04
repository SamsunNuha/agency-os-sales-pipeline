import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../common/types/jwt-user.type';

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: JwtUser) {
    return this.prisma.salesPipeline.findMany({
      where: { agencyId: user.agencyId },
      include: {
        stages: { orderBy: { order: 'asc' } },
        _count: { select: { deals: { where: { state: 'ACTIVE' } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, user: JwtUser) {
    const pipeline = await this.prisma.salesPipeline.findFirst({
      where: { id, agencyId: user.agencyId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { deals: { where: { state: 'ACTIVE' } } } } },
        },
        _count: { select: { deals: true } },
      },
    });
    if (!pipeline) {
      throw new NotFoundException({ message: 'Pipeline not found', code: 'PIPELINE_NOT_FOUND' });
    }
    return pipeline;
  }

  async create(dto: { name: string; description?: string }, user: JwtUser) {
    return this.prisma.salesPipeline.create({
      data: {
        agencyId: user.agencyId,
        name: dto.name,
        description: dto.description,
      },
      include: { stages: true },
    });
  }

  async update(id: string, dto: { name?: string; description?: string; isActive?: boolean }, user: JwtUser) {
    const pipeline = await this.prisma.salesPipeline.findFirst({ where: { id, agencyId: user.agencyId } });
    if (!pipeline) {
      throw new NotFoundException({ message: 'Pipeline not found', code: 'PIPELINE_NOT_FOUND' });
    }
    return this.prisma.salesPipeline.update({
      where: { id },
      data: dto,
      include: { stages: { orderBy: { order: 'asc' } } },
    });
  }

  async updateStages(
    pipelineId: string,
    stages: Array<{ id?: string; name: string; slug?: string; order: number; probability?: number; color?: string; isWon?: boolean; isLost?: boolean }>,
    user: JwtUser,
  ) {
    const pipeline = await this.prisma.salesPipeline.findFirst({
      where: { id: pipelineId, agencyId: user.agencyId },
      include: { stages: true },
    });
    if (!pipeline) {
      throw new NotFoundException({ message: 'Pipeline not found', code: 'PIPELINE_NOT_FOUND' });
    }

    // Validate: check that stages with active deals are not being deleted
    const existingStageIds = pipeline.stages.map((s) => s.id);
    const incomingStageIds = stages.filter((s) => s.id).map((s) => s.id as string);
    const deletedStageIds = existingStageIds.filter((id) => !incomingStageIds.includes(id));

    if (deletedStageIds.length > 0) {
      const activeDealCount = await this.prisma.deal.count({
        where: { stageId: { in: deletedStageIds }, state: 'ACTIVE', agencyId: user.agencyId },
      });
      if (activeDealCount > 0) {
        throw new BadRequestException({
          message: `Cannot delete stages with active deals. Move ${activeDealCount} deal(s) to another stage first.`,
          code: 'STAGE_HAS_ACTIVE_DEALS',
        });
      }
    }

    // Validate unique orders
    const orders = stages.map((s) => s.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException({ message: 'Stage orders must be unique', code: 'DUPLICATE_STAGE_ORDER' });
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete removed stages
      if (deletedStageIds.length > 0) {
        await tx.pipelineStage.deleteMany({ where: { id: { in: deletedStageIds } } });
      }

      // Upsert stages
      for (const stage of stages) {
        const slug = stage.slug || stage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (stage.id) {
          await tx.pipelineStage.update({
            where: { id: stage.id },
            data: {
              name: stage.name,
              slug,
              order: stage.order,
              probability: stage.probability ?? 50,
              color: stage.color ?? '#2563EB',
              isWon: stage.isWon ?? false,
              isLost: stage.isLost ?? false,
            },
          });
        } else {
          await tx.pipelineStage.create({
            data: {
              pipelineId,
              agencyId: user.agencyId,
              name: stage.name,
              slug,
              order: stage.order,
              probability: stage.probability ?? 50,
              color: stage.color ?? '#2563EB',
              isWon: stage.isWon ?? false,
              isLost: stage.isLost ?? false,
            },
          });
        }
      }

      return tx.salesPipeline.findFirst({
        where: { id: pipelineId },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
    });
  }
}
