import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ReviewService {
  constructor(private prisma: DatabaseService) {}
  // Tạo review mới
  async create(createReviewDto: CreateReviewDto): Promise<Review> {
    const {
      booking_id,
      customer_id,
      stylist_id,
      service_id,
      branch_id,
      rating,
      comment,
    } = createReviewDto;

    // Kiểm tra booking có tồn tại và thuộc về customer
    const booking = await this.prisma.booking.findUnique({
      where: { id: booking_id },
      include: { customer: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customer_id !== customer_id) {
      throw new BadRequestException('Booking does not belong to this customer');
    }

    // Kiểm tra stylist, service và branch
    const [stylist, service, branch] = await Promise.all([
      this.prisma.stylist.findUnique({ where: { id: stylist_id } }),
      this.prisma.service.findUnique({ where: { id: service_id } }),
      this.prisma.branch.findUnique({ where: { id: branch_id } }),
    ]);

    if (!stylist || !service || !branch) {
      throw new NotFoundException('Invalid stylist, service or branch');
    }

    // Kiểm tra rating hợp lệ
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    return this.prisma.review.create({
      data: {
        booking_id,
        customer_id,
        stylist_id,
        service_id,
        branch_id,
        rating,
        comment,
        is_visible: true,
      },
    });
  }

  // Lấy tất cả reviews
  async findAll(params: {
    skip?: number;
    take?: number;
    branch_id?: number;
    stylist_id?: number;
    service_id?: number;
  }): Promise<Review[]> {
    const { skip, take, branch_id, stylist_id, service_id } = params;

    return this.prisma.review.findMany({
      where: {
        is_visible: true,
        branch_id,
        stylist_id,
        service_id,
      },
      skip,
      take,
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        service: true,
        stylist: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  // Lấy review theo ID
  async findOne(id: number): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        service: true,
        stylist: true,
        branch: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  // Cập nhật review
  async update(id: number, updateReviewDto: UpdateReviewDto): Promise<Review> {
    const { rating, comment, is_visible } = updateReviewDto;

    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (rating && (rating < 1 || rating > 5)) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    return this.prisma.review.update({
      where: { id },
      data: {
        rating,
        comment,
        is_visible,
      },
    });
  }

  // Xóa review (soft delete bằng cách ẩn)
  async remove(id: number): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.prisma.review.update({
      where: { id },
      data: {
        is_visible: false,
      },
    });
  }

  // Lấy trung bình rating của stylist
  async getStylistAverageRating(stylist_id: number): Promise<number> {
    const result = await this.prisma.review.aggregate({
      where: {
        stylist_id,
        is_visible: true,
      },
      _avg: {
        rating: true,
      },
    });

    return result._avg.rating || 0;
  }

  // Lấy trung bình rating của service
  async getServiceAverageRating(service_id: number): Promise<number> {
    const result = await this.prisma.review.aggregate({
      where: {
        service_id,
        is_visible: true,
      },
      _avg: {
        rating: true,
      },
    });

    return result._avg.rating || 0;
  }
}
