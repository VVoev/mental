import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SpeakDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  voiceId?: string;
}
