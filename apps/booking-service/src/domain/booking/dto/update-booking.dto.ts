import { IsEnum, IsOptional, IsDateString } from 'class-validator';

export class UpdateBookingDto {
  @IsEnum(['pending', 'confirmed', 'completed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  startAt?: string;
}
