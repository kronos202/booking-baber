// apps/webhook-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WebhookModule } from './webhook.module';
import { rawBodyMiddleware } from 'src/middlewares/raw-body.middleware';

async function bootstrap() {
  const app = await NestFactory.create(WebhookModule);

  // Áp dụng rawBodyMiddleware
  app.use(rawBodyMiddleware());

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Webhook Service API')
    .setDescription(
      'API nhận webhook từ Stripe, VNPay, Twilio, Google Calendar',
    )
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3002);
}
bootstrap();
