import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../common/types/jwt-user.type';
import { FollowUpStatus, ActivityType } from '@prisma/client';
import { IsISO8601, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFollowUpDto {
  @ApiProperty({ example: '2025-02-15T10:00:00.000Z' })
  @IsISO8601()
  scheduledAt: string;

  @ApiProperty({ example: 'Follow up on the proposal sent last week.' })
  @IsString()
  @MaxLength(2000)
  note: string;
}

export class UpdateFollowUpDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() scheduledAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() completedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() rescheduledAt?: string;
  @ApiPropertyOptional() @IsOptional() status?: FollowUpStatus;
}

@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForDeal(dealId: string, dto: CreateFollowUpDto, user: JwtUser) {
    // Validate deal belongs to agency
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, agencyId: user.agencyId } });
    if (!deal) {
      throw new NotFoundException({ message: 'Deal not found', code: 'DEAL_NOT_FOUND' });
    }

    const followUp = await this.prisma.$transaction(async (tx) => {
      const fu = await tx.dealFollowUp.create({
        data: {
          dealId,
          agencyId: user.agencyId,
          scheduledAt: new Date(dto.scheduledAt),
          note: dto.note,
          status: FollowUpStatus.UPCOMING,
          createdById: user.sub,
        },
      });

      await tx.dealActivity.create({
        data: {
          dealId,
          agencyId: user.agencyId,
          activityType: ActivityType.FOLLOW_UP_SCHEDULED,
          description: `Follow-up scheduled for ${new Date(dto.scheduledAt).toLocaleDateString()}`,
          metadata: { followUpId: fu.id, scheduledAt: dto.scheduledAt },
          performedById: user.sub,
        },
      });

      // Update intelligence last activity
      await tx.dealIntelligence.upsert({
        where: { dealId },
        update: { lastActivityAt: new Date(), isStalled: false, stalledAt: null },
        create: { dealId, agencyId: user.agencyId, lastActivityAt: new Date() },
      });

      return fu;
    });

    return followUp;
  }

  async getForDeal(dealId: string, user: JwtUser) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, agencyId: user.agencyId } });
    if (!deal) {
      throw new NotFoundException({ message: 'Deal not found', code: 'DEAL_NOT_FOUND' });
    }

    return this.prisma.dealFollowUp.findMany({
      where: { dealId, agencyId: user.agencyId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async update(id: string, dto: UpdateFollowUpDto, user: JwtUser) {
    const followUp = await this.prisma.dealFollowUp.findFirst({
      where: { id, agencyId: user.agencyId },
    });
    if (!followUp) {
      throw new NotFoundException({ message: 'Follow-up not found', code: 'FOLLOW_UP_NOT_FOUND' });
    }

    let newStatus = followUp.status;
    let activityType: ActivityType = ActivityType.FOLLOW_UP_COMPLETED;

    if (dto.completedAt) {
      newStatus = FollowUpStatus.COMPLETED;
      activityType = ActivityType.FOLLOW_UP_COMPLETED;
    } else if (dto.rescheduledAt) {
      newStatus = FollowUpStatus.RESCHEDULED;
      activityType = ActivityType.FOLLOW_UP_RESCHEDULED;
    } else if (dto.status) {
      newStatus = dto.status;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.dealFollowUp.update({
        where: { id },
        data: {
          ...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
          ...(dto.note && { note: dto.note }),
          ...(dto.completedAt && { completedAt: new Date(dto.completedAt) }),
          ...(dto.rescheduledAt && { rescheduledAt: new Date(dto.rescheduledAt) }),
          status: newStatus,
        },
      });

      await tx.dealActivity.create({
        data: {
          dealId: followUp.dealId,
          agencyId: user.agencyId,
          activityType,
          description: `Follow-up ${newStatus.toLowerCase()}`,
          metadata: { followUpId: id },
          performedById: user.sub,
        },
      });

      await tx.dealIntelligence.upsert({
        where: { dealId: followUp.dealId },
        update: { lastActivityAt: new Date(), isStalled: false, stalledAt: null },
        create: { dealId: followUp.dealId, agencyId: user.agencyId, lastActivityAt: new Date() },
      });

      return result;
    });

    return updated;
  }

  async getAgencyFollowUps(user: JwtUser, status?: string) {
    // Sync overdue statuses
    const now = new Date();
    await this.prisma.dealFollowUp.updateMany({
      where: {
        agencyId: user.agencyId,
        status: FollowUpStatus.UPCOMING,
        scheduledAt: { lt: now },
      },
      data: { status: FollowUpStatus.OVERDUE },
    });

    return this.prisma.dealFollowUp.findMany({
      where: {
        agencyId: user.agencyId,
        ...(status && { status: status as FollowUpStatus }),
      },
      include: {
        deal: { select: { id: true, title: true, client: { select: { name: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
