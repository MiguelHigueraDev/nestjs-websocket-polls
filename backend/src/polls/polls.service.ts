import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Choice, Poll } from './interfaces/poll.interface';
import { CreatePollDto } from './dto/create-poll.dto';

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);
  private polls: Map<string, Poll> = new Map();

  private generatePollCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    if (this.polls.has(code)) {
      return this.generatePollCode();
    }
    return code;
  }

  public createPoll(createPollDto: CreatePollDto, hostId: string): Poll {
    const pollId = this.generatePollCode();
    const choices: Choice[] = createPollDto.choices.map((choice, index) => ({
      id: index,
      text: choice.text,
      votes: 0,
    }));

    const newPoll: Poll = {
      id: pollId,
      question: createPollDto.question,
      choices,
      isOpen: true,
      hostId,
      participants: new Map(),
    };

    this.polls.set(pollId, newPoll);
    this.logger.log(`Poll created: ${pollId} by host ${hostId}`);
    return newPoll;
  }

  public getPoll(pollId: string): Poll | undefined {
    return this.polls.get(pollId);
  }

  public joinPoll(pollId: string, participantId: string, name: string): Poll {
    const poll = this.getPoll(pollId);
    if (!poll) {
      throw new NotFoundException(`Poll ${pollId} not found.`);
    }

    if (!poll.isOpen && participantId !== poll.hostId) {
      throw new BadRequestException(`Poll ${pollId} is closed.`);
    }
    poll.participants.set(participantId, { name });
    this.logger.log(
      `Participant ${name} (${participantId}) joined poll ${pollId}`,
    );
    return poll;
  }

  public vote(pollId: string, participantId: string, choiceId: number) {
    const poll = this.getPoll(pollId);
    if (!poll) {
      throw new NotFoundException(`Poll ${pollId} not found.`);
    }

    if (!poll.isOpen) {
      throw new BadRequestException(`Poll ${pollId} is closed for voting.`);
    }

    const participant = poll.participants.get(participantId);
    if (!participant) {
      throw new BadRequestException(
        `Participant ${participantId} not found in poll ${pollId}.`,
      );
    }

    if (participant.votedChoiceId !== undefined) {
      throw new BadRequestException(
        `Participant ${participantId} has already voted in poll ${pollId}.`,
      );
    }

    const choice = poll.choices.find((c) => c.id === choiceId);
    if (!choice) {
      throw new BadRequestException(`Invalid choice ID: ${choiceId}`);
    }

    choice.votes++;
    participant.votedChoiceId = choiceId;
    this.logger.log(
      `Participant ${participantId} voted for choice ${choiceId} in poll ${pollId}`,
    );
    return poll;
  }

  public closePoll(pollId: string, hostId: string): Poll {
    const poll = this.getPoll(pollId);
    if (!poll) {
      throw new NotFoundException(`Poll ${pollId} not found.`);
    }

    if (poll.hostId !== hostId) {
      throw new BadRequestException(`You are not the host of poll ${pollId}.`);
    }

    poll.isOpen = false;
    this.logger.log(`Poll ${pollId} closed by host ${hostId}`);
    return poll;
  }

  public removeParticipant(
    socketId: string,
  ): { pollId: string; poll: Poll } | null {
    for (const [pollId, poll] of this.polls.entries()) {
      if (poll.participants.has(socketId)) {
        poll.participants.delete(socketId);
        this.logger.log(`Participant ${socketId} removed from poll ${pollId}`);
        if (poll.hostId === socketId) {
          this.logger.warn(`Host ${socketId} removed from poll ${pollId}`);
          poll.isOpen = false;
        }
        return { pollId, poll };
      }
      if (poll.hostId === socketId && !poll.participants.has(socketId)) {
        this.logger.warn(`Host ${socketId} removed from poll ${pollId}`);
        return { pollId, poll };
      }
    }
    return null;
  }

  // Get a sanitized poll view without hostId for participants
  public getSanitizedPoll(poll: Poll): Omit<Poll, 'hostId' | 'participants'> & {
    participants: { name: string }[];
  } {
    const { participants, ...rest } = poll;
    return {
      ...rest,
      participants: Array.from(participants.values()).map((p) => ({
        name: p.name,
      })),
    };
  }
}
