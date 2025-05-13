import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class VNPayProvider {
  private logger = new Logger(VNPayProvider.name);

  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {}

  createPayment(
    bookingId: number,
    amount: number,
    branchId: number,
  ): Promise<{ paymentUrl: string }> {
    this.logger.debug(
      `Creating VNPay payment for booking ${bookingId}, amount: ${amount}, branchId: ${branchId}`,
    );
    const params = new URLSearchParams(
      Object.entries({
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: this.configService.get('VNPAY_TMN_CODE') || '',
        vnp_Amount: (amount * 100).toString(),
        vnp_CurrCode: 'VND',
        vnp_TxnRef: bookingId.toString(),
        vnp_OrderInfo: `Thanh toan lich hen ${bookingId}`,
        vnp_OrderType: 'billpayment',
        vnp_Locale: 'vn',
        vnp_ReturnUrl: this.configService.get('VNPAY_RETURN_URL') || '',
        vnp_IpAddr: '127.0.0.1',
        vnp_CreateDate: new Date()
          .toISOString()
          .replace(/[-:T.]/g, '')
          .slice(0, 14),
      }).filter(([, value]) => value !== undefined),
    );

    const secureHash = createHmac(
      'sha512',
      this.configService.get('VNPAY_HASH_SECRET')!,
    )
      .update(params.toString())
      .digest('hex');
    params.append('vnp_SecureHash', secureHash);

    const paymentUrl = `${this.configService.get('VNPAY_PAYMENT_GATEWAY')}?${params.toString()}`;
    this.logger.log(`VNPay payment URL created: ${paymentUrl}`);
    return new Promise((resolve) => resolve({ paymentUrl }));
  }

  async handleCallback(query: any): Promise<any> {
    this.logger.debug('Handling VNPay callback');
    const secureHash = query.vnp_SecureHash;
    delete query.vnp_SecureHash;
    delete query.vnp_SecureHashType;

    const params = new URLSearchParams(query);
    const computedHash = createHmac(
      'sha512',
      this.configService.get('VNPAY_HASH_SECRET')!,
    )
      .update(params.toString())
      .digest('hex');

    if (secureHash !== computedHash) {
      this.logger.error('Invalid VNPay signature');
      throw new BadRequestException('Invalid signature');
    }

    const bookingId = parseInt(query.vnp_TxnRef);
    const payment = await this.databaseService.payment.findUnique({
      where: { booking_id: bookingId },
    });
    if (!payment) {
      this.logger.error(`Payment not found for booking ${bookingId}`);
      throw new BadRequestException('Payment not found');
    }

    if (query.vnp_ResponseCode === '00') {
      await this.databaseService.payment.update({
        where: { booking_id: bookingId },
        data: { status: 'SUCCEEDED', updated_at: new Date() },
      });
      await this.databaseService.booking.update({
        where: { id: bookingId },
        data: { status: 'confirmed' },
      });
      this.logger.log(`VNPay payment succeeded for booking ${bookingId}`);
    } else {
      await this.databaseService.payment.update({
        where: { booking_id: bookingId },
        data: { status: 'FAILED', updated_at: new Date() },
      });
      this.logger.warn(`VNPay payment failed for booking ${bookingId}`);
    }

    return { RspCode: '00', Message: 'Success' };
  }
}
