import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ServiceService {
  constructor(protected databaseService: DatabaseService) {}

  async createService(
    branchId: number,
    name: string,
    price: number,
    duration: number,
    userRole: string,
  ) {
    if (userRole !== 'admin' && userRole !== 'branch_manager')
      throw new ForbiddenException(
        'Only admins and branch managers can create services',
      );
    const branch = await this.databaseService.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new BadRequestException('Branch not found');
    return this.databaseService.service.create({
      data: { branch_id: branchId, name, price, duration },
    });
  }

  async getServices(branchId: number) {
    return this.databaseService.service.findMany({
      where: { branch_id: branchId },
    });
  }

  async getService(branchId: number, id: number) {
    const service = await this.databaseService.service.findUnique({
      where: { id },
    });
    if (!service || service.branch_id !== branchId)
      throw new BadRequestException('Service not found');
    return service;
  }

  async updateService(
    branchId: number,
    id: number,
    name: string,
    price: number,
    duration: number,
    userRole: string,
  ) {
    if (userRole !== 'admin' && userRole !== 'branch_manager')
      throw new ForbiddenException(
        'Only admins and branch managers can update services',
      );
    const service = await this.databaseService.service.findUnique({
      where: { id },
    });
    if (!service || service.branch_id !== branchId)
      throw new BadRequestException('Service not found');
    return this.databaseService.service.update({
      where: { id },
      data: { name, price, duration },
    });
  }

  async deleteService(branchId: number, id: number, userRole: string) {
    if (userRole !== 'admin' && userRole !== 'branch_manager')
      throw new ForbiddenException(
        'Only admins and branch managers can delete services',
      );
    const service = await this.databaseService.service.findUnique({
      where: { id },
    });
    if (!service || service.branch_id !== branchId)
      throw new BadRequestException('Service not found');
    return this.databaseService.service.delete({ where: { id } });
  }
}
