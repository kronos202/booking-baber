import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @IsInt()
  @Min(1)
  branchId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  @Min(1)
  duration: number;
}
