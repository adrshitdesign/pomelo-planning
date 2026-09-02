import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StatusesModule } from '../statuses/statuses.module';
import { CommentsController, CommentsService } from './comments.controller';

@Module({
  imports: [NotificationsModule, StatusesModule],
  controllers: [TicketsController, CommentsController],
  providers: [TicketsService, CommentsService],
  exports: [TicketsService],
})
export class TicketsModule {}
