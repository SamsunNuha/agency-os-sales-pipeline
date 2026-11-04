import { Module } from '@nestjs/common';
import { StalledDetectionController } from './stalled-detection.controller';
import { StalledDetectionService } from './stalled-detection.service';

@Module({
  controllers: [StalledDetectionController],
  providers: [StalledDetectionService],
  exports: [StalledDetectionService],
})
export class StalledDetectionModule {}
