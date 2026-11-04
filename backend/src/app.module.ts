import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DealsModule } from './deals/deals.module';
import { PipelinesModule } from './pipelines/pipelines.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { ProbabilityModule } from './probability/probability.module';
import { StalledDetectionModule } from './stalled-detection/stalled-detection.module';
import { ActivitiesModule } from './activities/activities.module';
import { HandoffModule } from './handoff/handoff.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    DealsModule,
    PipelinesModule,
    FollowUpsModule,
    ProbabilityModule,
    StalledDetectionModule,
    ActivitiesModule,
    HandoffModule,
    DashboardModule,
  ],
})
export class AppModule {}
