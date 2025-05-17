// dto/update-review.dto.ts
import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

export class UpdateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsBoolean()
  @IsOptional()
  is_visible?: boolean;
}
