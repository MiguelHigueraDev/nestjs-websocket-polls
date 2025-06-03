/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Logger,
  NotFoundException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PollsService } from './polls.service';
import { Poll } from './interfaces/poll.interface';
import { CreatePollDto } from './dto/create-poll.dto';
import { JoinPollDto } from './dto/join-poll.dto';
import { VoteDto } from './dto/vote.dto';

@UsePipes(new ValidationPipe())
@WebSocketGateway({
  cors: {
    // TODO: Change to production origin
    origin: '*',
  },
})
export class PollsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PollsGateway.name);
  @WebSocketServer() server: Server;

  constructor(private readonly pollsService: PollsService) {}

  public handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  public handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const result = this.pollsService.removeParticipant(client.id);
    if (result) {
      const { pollId, poll } = result;
      this.emitPollUpdate(poll);
      this.logger.log(
        `Poll ${pollId} updated after user ${client.id} disconnected`,
      );
    }
  }

  private emitPollUpdate(poll: Poll) {
    // For participants, send sanitized poll
    const sanitizedPoll = this.pollsService.getSanitizedPoll(poll);
    this.server.to(poll.id).emit('poll-updated', sanitizedPoll);

    // For host, send full poll
    const hostSocket = this.server.sockets.sockets.get(poll.hostId);
    if (hostSocket) {
      hostSocket.emit('poll-updated', poll);
    }
  }

  @SubscribeMessage('createPoll')
  async handleCreatePoll(
    @MessageBody() createPollDto: CreatePollDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      this.logger.log(
        `Attempting to create poll: ${JSON.stringify(createPollDto)} by ${client.id}`,
      );
      const poll = this.pollsService.createPoll(createPollDto, client.id);
      await client.join(poll.id);
      client.emit('pollCreated', poll); // Send full poll details back to host
      this.logger.log(`Poll ${poll.id} created by ${client.id}`);
    } catch (error) {
      this.logger.error(`Error creating poll: ${error.message}`, error.stack);
      client.emit('error', {
        message: error.message || 'Failed to create poll',
      });
    }
  }

  @SubscribeMessage('joinPoll')
  async handleJoinPoll(
    @MessageBody() joinPollDto: JoinPollDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      this.logger.log(
        `Attempting to join poll: ${joinPollDto.pollId} by ${client.id}`,
      );
      const poll = this.pollsService.joinPoll(
        joinPollDto.pollId,
        client.id,
        joinPollDto.name,
      );
      await client.join(poll.id);

      client.emit('pollJoined', this.pollsService.getSanitizedPoll(poll));
      this.logger.log(
        `Client ${client.id} joined poll ${poll.id}. Room size: ${this.server.sockets.adapter.rooms.get(poll.id)?.size}`,
      );
    } catch (error) {
      this.logger.error(`Error joined poll: ${error.message}`, error.stack);
      client.emit('error', {
        message: error.message || 'Failed to join poll',
      });
    }
  }

  @SubscribeMessage('vote')
  handleVote(
    @MessageBody() voteDto: VoteDto,
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      this.logger.log(
        `Client ${client.id} attempting to vote: ${JSON.stringify(voteDto)}`,
      );
      const poll = this.pollsService.vote(
        voteDto.pollId,
        client.id,
        voteDto.choiceId,
      );
      this.emitPollUpdate(poll);
      this.logger.log(`Vote successful for poll ${poll.id} by ${client.id}.`);
    } catch (error) {
      this.logger.error(`Error voting: ${error.message}`, error.stack);
      client.emit('error', { message: error.message || 'Failed to vote.' });
    }
  }

  @SubscribeMessage('closePoll')
  handleClosePoll(
    @MessageBody('pollId') pollId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    if (!pollId) {
      client.emit('error', { message: 'pollId is required.' });
      return;
    }
    try {
      this.logger.log(`Host ${client.id} attempting to close poll: ${pollId}`);
      const poll = this.pollsService.closePoll(pollId, client.id);
      this.emitPollUpdate(poll); // Notify everyone that poll is closed and show final results
      this.logger.log(`Poll ${poll.id} closed by host ${client.id}.`);
    } catch (error) {
      this.logger.error(`Error closing poll: ${error.message}`, error.stack);
      client.emit('error', {
        message: error.message || 'Failed to close poll.',
      });
    }
  }

  @SubscribeMessage('getPollState')
  handleGetPollState(
    @MessageBody('pollId') pollId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    if (!pollId) {
      client.emit('error', { message: 'pollId is required.' });
      return;
    }
    try {
      const poll = this.pollsService.getPoll(pollId);
      if (!poll) {
        throw new NotFoundException(`Poll with ID "${pollId}" not found.`);
      }
      // If client is host, send full poll, otherwise sanitized
      const dataToSend =
        client.id === poll.hostId
          ? poll
          : this.pollsService.getSanitizedPoll(poll);
      client.emit('pollState', dataToSend);
    } catch (error) {
      this.logger.error(
        `Error getting poll state: ${error.message}`,
        error.stack,
      );
      client.emit('error', {
        message: error.message || 'Failed to get poll state.',
      });
    }
  }
}
