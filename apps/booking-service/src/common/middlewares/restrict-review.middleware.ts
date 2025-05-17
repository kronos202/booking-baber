// src/review/middlewares/restrict-review.middleware.ts
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class RestrictReviewMiddleware implements NestMiddleware {
  constructor(private readonly prisma: DatabaseService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Giả định user đã được gắn vào req từ middleware xác thực trước đó (ví dụ: JWT)
    const user = req.user as { id: number }; // Cần middleware xác thực trước để gán user
    const { booking_id, customer_id } = req.body; // Lấy từ body của request

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Kiểm tra user có phải là customer đang gửi request
    if (user.id !== customer_id) {
      throw new UnauthorizedException(
        'You can only create reviews for yourself',
      );
    }

    // Kiểm tra booking có tồn tại và thuộc về customer
    const booking = await this.prisma.booking.findUnique({
      where: { id: booking_id },
      select: { customer_id: true, status: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customer_id !== user.id) {
      throw new UnauthorizedException('This booking does not belong to you');
    }

    // Kiểm tra trạng thái booking (chỉ booking đã hoàn thành mới được review)
    if (booking.status !== 'completed') {
      throw new UnauthorizedException('You can only review completed bookings');
    }

    next();
  }
}
