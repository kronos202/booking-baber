// apps/webhook-service/src/vnpay-webhook/dto/vnpay-webhook.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VnpayWebhookDto {
  @ApiProperty({ description: 'Mã giao dịch VNPay', example: '123456' })
  @IsString()
  @IsNotEmpty()
  vnp_TransactionNo: string;

  @ApiProperty({ description: 'Số tiền giao dịch (VND)', example: '1000000' })
  @IsString()
  @IsNotEmpty()
  vnp_Amount: string;

  @ApiProperty({ description: 'Trạng thái giao dịch', example: '00' })
  @IsString()
  @IsNotEmpty()
  vnp_TransactionStatus: string;

  @ApiProperty({ description: 'Mã tham chiếu giao dịch', example: '1' })
  @IsString()
  @IsNotEmpty()
  vnp_TxnRef: string;

  @ApiProperty({ description: 'Chữ ký bảo mật', example: 'abc123...' })
  @IsString()
  @IsNotEmpty()
  vnp_SecureHash: string;
}
