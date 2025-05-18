export class BranchResponseDto {
  id: number;
  name: string;
  address: string;
  phone?: string;
  imageUrl?: string;
  open_time: string;
  close_time: string;
  created_at: Date;
  services?: any[];
  stylists?: any[];
  bookings?: any[];
  reviews?: any[];
}
