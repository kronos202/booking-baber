import { IsInt, IsOptional, IsEnum, Min } from 'class-validator';
enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
}
export class GetNotificationsDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @IsEnum([...Object.values(NotificationStatus), 'ALL'])
  @IsOptional()
  status?: NotificationStatus | 'ALL' = 'ALL';
}
