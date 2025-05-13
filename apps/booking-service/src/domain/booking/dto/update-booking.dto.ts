import { IsString } from 'class-validator';

export class UpdateBookingDto {
  @IsString()
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}
