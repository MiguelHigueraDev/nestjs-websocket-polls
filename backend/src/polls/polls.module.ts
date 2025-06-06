import { Module } from '@nestjs/common';
import { PollsService } from './polls.service';
import { PollsGateway } from './polls.gateway';

@Module({
  providers: [PollsService, PollsGateway],
})
export class PollsModule {}
