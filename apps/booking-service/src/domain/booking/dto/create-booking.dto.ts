import { IsInt, IsNumber, IsString, IsDateString, Min } from 'class-validator';

export class CreateBookingDto {
  @IsInt()
  branch_id: number;

  @IsInt()
  stylist_id: number;

  @IsInt()
  service_id: number;

  @IsDateString()
  booking_time: string;

  @IsNumber()
  @Min(0)
  total_price: number;

  @IsString()
  branch_name: string;

  @IsString()
  service_name: string;

  @IsString()
  customer_name: string;

  @IsInt()
  duration: number;

  @IsString()
  payment_method: 'stripe' | 'vnpay' | 'cash';
}
