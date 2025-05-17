import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { RestrictReviewMiddleware } from 'src/common/middlewares/restrict-review.middleware';

@Module({
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RestrictReviewMiddleware)
      .forRoutes({ path: 'reviews', method: RequestMethod.POST });
  }
}
