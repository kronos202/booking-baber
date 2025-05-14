import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateNotificationDto {
  @IsInt()
  @IsPositive()
  userId: number;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(['email', 'sms', 'push'], { each: true })
  @IsOptional()
  channels?: string[];
}
