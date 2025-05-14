// apps/webhook-service/src/middlewares/raw-body.middleware.ts
import { Request, Response } from 'express';
import { json } from 'body-parser';

export interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}

export function rawBodyMiddleware() {
  return json({
    verify: (
      request: RequestWithRawBody,
      response: Response,
      buffer: Buffer,
    ) => {
      if (!Buffer.isBuffer(buffer)) {
        console.error('Invalid buffer for raw body:', buffer);
        return;
      }

      const webhookEndpoints = ['/webhook/stripe', '/webhook/vnpay'];
      if (webhookEndpoints.includes(request.url) && Buffer.isBuffer(buffer)) {
        request.rawBody = Buffer.from(buffer);
        console.log(
          `Raw body saved for ${request.url}:`,
          request.rawBody.toString(),
        );
      }

      return true;
    },
  });
}
