import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../common/types/jwt-user.type';
import { ActivityType } from '@prisma/client';

@Injectable()
export class HandoffService {
  constructor(private readonly prisma: PrismaService) {}

  async initiateHandoff(dealId: string, user: JwtUser) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, agencyId: user.agencyId },
      include: {
        client: { select: { id: true, name: true, email: true, company: true } },
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        pipeline: { select: { name: true } },
        stage: { select: { name: true } },
      },
    });

    if (!deal) {
      throw new NotFoundException({ message: 'Deal not found', code: 'DEAL_NOT_FOUND' });
    }

    if (deal.state !== 'WON') {
      throw new BadRequestException({
        message: 'Only Won deals can be handed off to a project',
        code: 'DEAL_NOT_WON',
      });
    }

    if (deal.handedOffAt) {
      throw new ConflictException({
        message: 'This deal has already been handed off',
        code: 'ALREADY_HANDED_OFF',
        details: { handedOffAt: deal.handedOffAt },
      });
    }

    // Build the stable handoff payload
    const handoffPayload = {
      dealId: deal.id,
      clientId: deal.clientId,
      dealTitle: deal.title,
      serviceCategory: deal.serviceCategory,
      agreedValue: deal.expectedValue,
      currency: deal.currency,
      dealOwner: {
        id: deal.owner.id,
        name: `${deal.owner.firstName} ${deal.owner.lastName}`,
        email: deal.owner.email,
      },
      client: deal.client,
      notes: deal.notes,
      tags: deal.tags,
      wonStatus: 'WON',
      wonAt: deal.wonAt,
      handoffInitiatedAt: new Date(),
      handoffInitiatedBy: user.sub,
      agencyId: deal.agencyId,
      // Integration metadata for the Project module
      integrationMeta: {
        sourceModule: 'sales-pipeline',
        schemaVersion: '1.0',
        integrationType: 'project-handoff',
      },
    };

    // Record handoff in DB (idempotent — only set once)
    await this.prisma.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: dealId },
        data: { handedOffAt: new Date() },
      });

      await tx.dealActivity.create({
        data: {
          dealId,
          agencyId: user.agencyId,
          activityType: ActivityType.HANDOFF_INITIATED,
          description: `Project handoff initiated for deal "${deal.title}"`,
          metadata: { handoffPayload },
          performedById: user.sub,
        },
      });
    });

    return handoffPayload;
  }
}
