// booking/dto/create-booking.dto.ts
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
} from 'class-validator';

export class CreateBookingDto {
  @IsInt()
  @IsPositive()
  branch_id: number;

  @IsInt()
  @IsPositive()
  stylist_id: number;

  @IsInt()
  @IsPositive()
  service_id: number;

  @IsDateString()
  @IsNotEmpty()
  booking_time: string;

  @IsInt()
  @IsPositive()
  total_price: number;

  @IsString()
  @IsNotEmpty()
  service_name: string;

  @IsString()
  @IsNotEmpty()
  branch_name: string;

  @IsString()
  @IsNotEmpty()
  customer_name: string;

  @IsInt()
  @IsPositive()
  duration: number;

  @IsEnum(['stripe', 'vnpay', 'cash'])
  payment_method: string;

  @IsEnum(['email', 'sms', 'push'], { each: true })
  @IsOptional()
  notification_channels?: string[];
}
