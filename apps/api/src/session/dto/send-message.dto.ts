import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { LIMITS } from '@mental-help/shared';

export class MessageDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() @Matches(/\S/) @MaxLength(LIMITS.message) content!: string;
}
export class SendMessageDto {
  @IsInt() @Min(0) @Max(130) age!: number;
  @IsString() @Matches(/\S/) @MaxLength(LIMITS.message) presentingIssue!: string;
  @IsOptional() @IsString() @MaxLength(LIMITS.goal) goal?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(LIMITS.turns)
  @ValidateNested({ each: true }) @Type(() => MessageDto) messages!: MessageDto[];
}
