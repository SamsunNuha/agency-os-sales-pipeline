import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { ProbabilityModule } from '../probability/probability.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [ProbabilityModule, CommonModule],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
