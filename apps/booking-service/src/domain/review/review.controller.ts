import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  create(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewService.create(createReviewDto);
  }

  @Get()
  findAll(
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Query('branch_id') branch_id: string,
    @Query('stylist_id') stylist_id: string,
    @Query('service_id') service_id: string,
  ) {
    return this.reviewService.findAll({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      branch_id: branch_id ? Number(branch_id) : undefined,
      stylist_id: stylist_id ? Number(stylist_id) : undefined,
      service_id: service_id ? Number(service_id) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewService.update(Number(id), updateReviewDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviewService.remove(Number(id));
  }

  @Get('stylist/:stylist_id/average-rating')
  getStylistAverageRating(@Param('stylist_id') stylist_id: string) {
    return this.reviewService.getStylistAverageRating(Number(stylist_id));
  }

  @Get('service/:service_id/average-rating')
  getServiceAverageRating(@Param('service_id') service_id: string) {
    return this.reviewService.getServiceAverageRating(Number(service_id));
  }
}
