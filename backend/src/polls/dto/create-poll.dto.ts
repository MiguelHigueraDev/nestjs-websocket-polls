import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class ChoiceDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  text: string;
}

export class CreatePollDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  question: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ChoiceDto)
  choices: ChoiceDto[];
}
