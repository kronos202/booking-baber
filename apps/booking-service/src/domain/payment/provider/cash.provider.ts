import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CashProvider {
  private logger = new Logger(CashProvider.name);

  async createPayment(
    bookingId: number,
    amount: number,
    branchId: number,
  ): Promise<{ message: string }> {
    this.logger.debug(
      `Creating Cash payment for booking ${bookingId}, amount: ${amount}, branchId: ${branchId}`,
    );
    return new Promise((resolve) =>
      resolve({ message: 'Cash payment created' }),
    );
  }
}
