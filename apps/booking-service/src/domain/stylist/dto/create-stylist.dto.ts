import { IsString, IsOptional, IsNotEmpty, IsInt, Min } from 'class-validator';

export class CreateStylistDto {
  @IsInt()
  @Min(1)
  branchId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
