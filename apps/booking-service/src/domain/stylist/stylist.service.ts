import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class StylistService {
  constructor(protected databaseService: DatabaseService) {}

  async createStylist(
    branchId: number,
    name: string,
    phone: string,
    userRole: string,
  ) {
    if (userRole !== 'admin' && userRole !== 'branch_manager')
      throw new ForbiddenException(
        'Only admins and branch managers can create stylists',
      );
    const branch = await this.databaseService.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new BadRequestException('Branch not found');
    return this.databaseService.stylist.create({
      data: { branch_id: branchId, name, phone },
    });
  }

  async getStylists(branchId: number) {
    return this.databaseService.stylist.findMany({
      where: { branch_id: branchId },
    });
  }

  async getStylist(branchId: number, id: number) {
    const stylist = await this.databaseService.stylist.findUnique({
      where: { id },
    });
    if (!stylist || stylist.branch_id !== branchId)
      throw new BadRequestException('Stylist not found');
    return stylist;
  }

  async updateStylist(
    branchId: number,
    id: number,
    name: string,
    phone: string,
    userRole: string,
  ) {
    if (userRole !== 'admin' && userRole !== 'branch_manager')
      throw new ForbiddenException(
        'Only admins and branch managers can update stylists',
      );
    const stylist = await this.databaseService.stylist.findUnique({
      where: { id },
    });
    if (!stylist || stylist.branch_id !== branchId)
      throw new BadRequestException('Stylist not found');
    return this.databaseService.stylist.update({
      where: { id },
      data: { name, phone },
    });
  }

  async deleteStylist(branchId: number, id: number, userRole: string) {
    if (userRole !== 'admin' && userRole !== 'branch_manager')
      throw new ForbiddenException(
        'Only admins and branch managers can delete stylists',
      );
    const stylist = await this.databaseService.stylist.findUnique({
      where: { id },
    });
    if (!stylist || stylist.branch_id !== branchId)
      throw new BadRequestException('Stylist not found');
    return this.databaseService.stylist.delete({ where: { id } });
  }
}
