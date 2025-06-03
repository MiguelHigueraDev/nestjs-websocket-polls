import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class JoinPollDto {
  @IsNotEmpty()
  @IsString()
  pollId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  name: string;
}
