import { IsEnum, IsOptional } from 'class-validator';

export class UpdateNotificationDto {
  @IsEnum(['UNREAD', 'READ'])
  @IsOptional()
  status?: string;
}
