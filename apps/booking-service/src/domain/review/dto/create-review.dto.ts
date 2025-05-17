import { IsInt, IsString, IsOptional, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  booking_id: number;

  @IsInt()
  customer_id: number;

  @IsInt()
  stylist_id: number;

  @IsInt()
  service_id: number;

  @IsInt()
  branch_id: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
