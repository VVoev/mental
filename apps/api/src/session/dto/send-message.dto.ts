import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  content!: string;
}

export class SendMessageDto {
  @IsInt()
  @Min(0)
  age!: number;

  @IsString()
  @MinLength(1)
  presentingIssue!: string;

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages!: MessageDto[];
}
