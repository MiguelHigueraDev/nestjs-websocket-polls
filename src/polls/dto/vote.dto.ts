import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class VoteDto {
  @IsNotEmpty()
  @IsString()
  pollId: string;

  @IsNotEmpty()
  @IsNumber()
  choiceId: number;
}
