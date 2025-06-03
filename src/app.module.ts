import { Module } from '@nestjs/common';
import { PollsModule } from './polls/polls.module';

@Module({
  imports: [PollsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
